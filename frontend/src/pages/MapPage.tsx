import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useEffect, useRef, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, InterpolationResult, PageResponse, Site } from '../api/client'
import { GRADES, gradeOf } from '../config/grades'
import { MAP_CONFIG } from '../config/mapConfig'

/** 시각화 API 응답 공통 형태 (관측/예측 레이어) */
interface VizPoint {
  siteId: number
  siteName: string
  latitude: number
  longitude: number
  pm25: number
  grade: string
  observedAt?: string
  predictedAt?: string
}

type LayerKey = 'observation' | 'prediction' | 'interpolation'

const LAYER_LABELS: Record<LayerKey, string> = {
  observation: '관측값',
  prediction: 'AI 예측값',
  interpolation: 'IDW 보간값',
}

/** PM2.5 값 → 등급 색상 (Cesium Color) */
function pm25Color(pm25: number, alpha: number): Cesium.Color {
  return Cesium.Color.fromCssColorString(gradeOf(pm25).chart).withAlpha(alpha)
}

/** 팝업(InfoBox) HTML 생성. 지점명은 InfoBox 제목(entity.name)으로 표시된다. */
function buildDescription(type: string, _name: string, pm25: number, time: string | undefined,
                          lat: number, lng: number): string {
  const grade = gradeOf(pm25)
  return `
    <table class="cesium-infoBox-defaultTable"><tbody>
      <tr><th>구분</th><td>${type}</td></tr>
      <tr><th>PM2.5</th><td><b>${pm25.toFixed(1)}</b> ㎍/㎥ (${grade.name})</td></tr>
      <tr><th>기준 시각</th><td>${time ? new Date(time).toLocaleString('ko-KR') : '-'}</td></tr>
      <tr><th>좌표</th><td>${lat.toFixed(4)}, ${lng.toFixed(4)}</td></tr>
    </tbody></table>`
}

/** 지점 주변 3x3x2 반투명 박스 격자를 데이터소스에 추가 */
function addGrid(ds: Cesium.CustomDataSource, lng: number, lat: number, pm25: number,
                 name: string, type: string) {
  const g = MAP_CONFIG.grid
  // 위경도 1도당 미터 근사 (수도권 위도 기준)
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180)

  for (let ix = 0; ix < g.countX; ix++) {
    for (let iy = 0; iy < g.countY; iy++) {
      for (let iz = 0; iz < g.countZ; iz++) {
        const dx = (ix - (g.countX - 1) / 2) * g.spacing
        const dy = (iy - (g.countY - 1) / 2) * g.spacing
        const altitude = g.baseAltitude + iz * g.levelGap
        ds.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            lng + dx / mPerDegLng,
            lat + dy / mPerDegLat,
            altitude,
          ),
          box: {
            dimensions: new Cesium.Cartesian3(g.boxSize, g.boxSize, g.boxHeight),
            material: pm25Color(pm25, MAP_CONFIG.boxAlpha),
            outline: ix === 1 && iy === 1,
            outlineColor: pm25Color(pm25, 0.8),
          },
          name: `${name} 미세먼지 격자`,
          description: buildDescription(type, name, pm25, undefined, lat, lng),
        })
      }
    }
  }
}

/** 지점 마커(포인트 + 라벨) 추가 */
function addMarker(ds: Cesium.CustomDataSource, p: { latitude: number; longitude: number },
                   name: string, color: string, description: string) {
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 10),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString(color),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: name,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -18),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    },
    name,
    description,
  })
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const dataSourcesRef = useRef<Record<LayerKey, Cesium.CustomDataSource> | null>(null)

  const [sites, setSites] = useState<Site[]>([])
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    observation: true,
    prediction: true,
    interpolation: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Viewer 생성 + 데이터 로드
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
    if (ionToken) Cesium.Ion.defaultAccessToken = ionToken

    const viewer = new Cesium.Viewer(containerRef.current, {
      // ion 토큰이 없으면 OSM 타일로 폴백 (토큰 없이도 동작 보장)
      baseLayer: ionToken
        ? undefined
        : Cesium.ImageryLayer.fromProviderAsync(
            Promise.resolve(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/',
              }),
            ),
          ),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: true,
    })
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewerRef.current = viewer

    const dataSources: Record<LayerKey, Cesium.CustomDataSource> = {
      observation: new Cesium.CustomDataSource('observation'),
      prediction: new Cesium.CustomDataSource('prediction'),
      interpolation: new Cesium.CustomDataSource('interpolation'),
    }
    Object.values(dataSources).forEach((ds) => viewer.dataSources.add(ds))
    dataSourcesRef.current = dataSources

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        MAP_CONFIG.initialView.longitude,
        MAP_CONFIG.initialView.latitude,
        MAP_CONFIG.initialView.height,
      ),
    })

    // 데이터 로드
    Promise.all([
      apiClient.get<ApiResponse<Site[]>>('/sites'),
      apiClient.get<ApiResponse<VizPoint[]>>('/viz/observations/latest'),
      apiClient.get<ApiResponse<VizPoint[]>>('/viz/predictions/latest'),
      apiClient.get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=100'),
    ])
      .then(([siteRes, obsRes, predRes, idwRes]) => {
        setSites(siteRes.data.data)

        // 관측 레이어: 마커 + 격자
        for (const o of obsRes.data.data) {
          addMarker(dataSources.observation, o, o.siteName, MAP_CONFIG.markers.observation,
            buildDescription('관측값', o.siteName, o.pm25, o.observedAt, o.latitude, o.longitude))
          addGrid(dataSources.observation, o.longitude, o.latitude, o.pm25, o.siteName, '관측값')
        }

        // 예측 레이어: 마커 + 격자 (관측과 겹치지 않게 마커만 다른 색)
        for (const p of predRes.data.data) {
          addMarker(dataSources.prediction, p, `${p.siteName} (예측)`, MAP_CONFIG.markers.prediction,
            buildDescription('AI 예측값', p.siteName, p.pm25, p.predictedAt, p.latitude, p.longitude))
          addGrid(dataSources.prediction, p.longitude, p.latitude, p.pm25, p.siteName, 'AI 예측값')
        }

        // 보간 레이어: 마커 + 단일 박스 (중복 지점은 최신 1건만)
        const seen = new Set<string>()
        for (const r of idwRes.data.data.content) {
          const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
          if (seen.has(key)) continue
          seen.add(key)
          const name = r.targetName ?? `보간지점 ${r.id}`
          addMarker(dataSources.interpolation, r, name, MAP_CONFIG.markers.interpolation,
            buildDescription('IDW 보간값', name, r.pm25, r.interpolatedAt, r.latitude, r.longitude))
          dataSources.interpolation.entities.add({
            position: Cesium.Cartesian3.fromDegrees(
              r.longitude, r.latitude, MAP_CONFIG.grid.baseAltitude),
            box: {
              dimensions: new Cesium.Cartesian3(
                MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxHeight),
              material: pm25Color(r.pm25, MAP_CONFIG.boxAlpha),
              outline: true,
              outlineColor: pm25Color(r.pm25, 0.8),
            },
            name,
            description: buildDescription('IDW 보간값', name, r.pm25, r.interpolatedAt,
              r.latitude, r.longitude),
          })
        }
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))

    return () => {
      viewer.destroy()
      viewerRef.current = null
      dataSourcesRef.current = null
    }
  }, [])

  // 레이어 표시/숨김
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds) return
    ;(Object.keys(layers) as LayerKey[]).forEach((key) => {
      ds[key].show = layers[key]
    })
  }, [layers])

  const flyToSite = (site: Site) => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(site.longitude, site.latitude - 0.04, 6000),
      orientation: { pitch: Cesium.Math.toRadians(-35) },
      duration: 1.8,
    })
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">3D 지도</h2>

        {(Object.keys(LAYER_LABELS) as LayerKey[]).map((key) => (
          <label key={key} className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={(e) => setLayers({ ...layers, [key]: e.target.checked })}
            />
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: MAP_CONFIG.markers[key] }}
            />
            {LAYER_LABELS[key]}
          </label>
        ))}

        <select
          onChange={(e) => {
            const site = sites.find((s) => s.id === Number(e.target.value))
            if (site) flyToSite(site)
          }}
          defaultValue=""
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="" disabled>
            관측소로 이동...
          </option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          {GRADES.map((g) => (
            <span key={g.name} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: g.chart }} />
              {g.name}
              {g.upper != null && ` ≤${g.upper}`}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-500">지도 데이터 불러오는 중...</p>}

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200" />

      <p className="text-xs text-gray-400">
        박스를 클릭하면 상세정보가 표시됩니다 · 격자: 관측소당{' '}
        {MAP_CONFIG.grid.countX}x{MAP_CONFIG.grid.countY}x{MAP_CONFIG.grid.countZ} · ion 토큰
        없이 OSM 지도로 동작 (.env의 VITE_CESIUM_ION_TOKEN으로 위성영상 사용 가능)
      </p>
    </div>
  )
}
