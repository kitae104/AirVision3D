import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useEffect, useRef, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, InterpolationResult, PageResponse, Site } from '../api/client'
import { GRADES, gradeOf } from '../config/grades'
import { MAP_CONFIG } from '../config/mapConfig'

/** 시각화 API 응답 (관측/예측 최신값) */
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

/** 시계열 API 응답 (관측소별 샘플 목록) */
interface SeriesSite {
  siteId: number
  siteName: string
  latitude: number
  longitude: number
  samples: { time: string; pm25: number }[]
}

type LayerKey = 'observation' | 'prediction' | 'interpolation'

const LAYER_LABELS: Record<LayerKey, string> = {
  observation: '관측값',
  prediction: 'AI 예측값',
  interpolation: 'IDW 보간값',
}

/** 시계열 샘플 1건이 유효한 시간 길이 (시간 단위 관측 가정) */
const SAMPLE_DURATION_SEC = 3600

function pm25Color(pm25: number, alpha: number): Cesium.Color {
  return Cesium.Color.fromCssColorString(gradeOf(pm25).chart).withAlpha(alpha)
}

/** 팝업(InfoBox) HTML. 지점명은 InfoBox 제목(entity.name)으로 표시된다. */
function buildDescription(type: string, pm25: number | null, time: string | undefined,
                          lat: number, lng: number): string {
  const gradeRow = pm25 != null
    ? `<tr><th>PM2.5</th><td><b>${pm25.toFixed(1)}</b> ㎍/㎥ (${gradeOf(pm25).name})</td></tr>`
    : ''
  return `
    <table class="cesium-infoBox-defaultTable"><tbody>
      <tr><th>구분</th><td>${type}</td></tr>
      ${gradeRow}
      <tr><th>기준 시각</th><td>${time ? new Date(time).toLocaleString('ko-KR') : '시계열 (Timeline 참조)'}</td></tr>
      <tr><th>좌표</th><td>${lat.toFixed(4)}, ${lng.toFixed(4)}</td></tr>
    </tbody></table>`
}

/** 격자 박스 중심 좌표 목록 계산 */
function gridPositions(lng: number, lat: number) {
  const g = MAP_CONFIG.grid
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180)
  const positions: { lng: number; lat: number; alt: number; center: boolean }[] = []
  for (let ix = 0; ix < g.countX; ix++) {
    for (let iy = 0; iy < g.countY; iy++) {
      for (let iz = 0; iz < g.countZ; iz++) {
        positions.push({
          lng: lng + ((ix - (g.countX - 1) / 2) * g.spacing) / mPerDegLng,
          lat: lat + ((iy - (g.countY - 1) / 2) * g.spacing) / mPerDegLat,
          alt: g.baseAltitude + iz * g.levelGap,
          center: ix === (g.countX - 1) / 2 && iy === (g.countY - 1) / 2,
        })
      }
    }
  }
  return positions
}

/** 정적(현재값) 격자 추가 */
function addStaticGrid(ds: Cesium.CustomDataSource, lng: number, lat: number, pm25: number,
                       name: string, type: string) {
  for (const pos of gridPositions(lng, lat)) {
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
      box: {
        dimensions: new Cesium.Cartesian3(
          MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxHeight),
        material: pm25Color(pm25, MAP_CONFIG.boxAlpha),
        outline: pos.center,
        outlineColor: pm25Color(pm25, 0.8),
      },
      name: `${name} 미세먼지 격자`,
      description: buildDescription(type, pm25, undefined, lat, lng),
    })
  }
}

/** 지점 마커(포인트+라벨) 추가. labelText에 Property를 주면 시간에 따라 변한다. */
function addMarker(ds: Cesium.CustomDataSource, lng: number, lat: number, name: string,
                   color: string, description: string,
                   labelText?: Cesium.Property | string) {
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lng, lat, 10),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString(color),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: (labelText ?? name) as string,
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

/**
 * 시계열 격자 추가: 샘플별 1시간 구간의 색상/라벨을 TimeIntervalCollectionProperty로 구성.
 * 데이터가 없는 시간은 entity availability로 숨긴다 (완료 조건: 데이터 없는 시간 처리).
 */
function addTimeSeriesSite(ds: Cesium.CustomDataSource, site: SeriesSite) {
  const colorProp = new Cesium.TimeIntervalCollectionProperty()
  const outlineProp = new Cesium.TimeIntervalCollectionProperty()
  const labelProp = new Cesium.TimeIntervalCollectionProperty()
  const availability = new Cesium.TimeIntervalCollection()

  for (const sample of site.samples) {
    const start = Cesium.JulianDate.fromIso8601(sample.time)
    const stop = Cesium.JulianDate.addSeconds(start, SAMPLE_DURATION_SEC, new Cesium.JulianDate())
    const opts = { start, stop, isStartIncluded: true, isStopIncluded: false }
    colorProp.intervals.addInterval(
      new Cesium.TimeInterval({ ...opts, data: pm25Color(sample.pm25, MAP_CONFIG.boxAlpha) }))
    outlineProp.intervals.addInterval(
      new Cesium.TimeInterval({ ...opts, data: pm25Color(sample.pm25, 0.8) }))
    labelProp.intervals.addInterval(
      new Cesium.TimeInterval({
        ...opts,
        data: `${site.siteName}\n${sample.pm25.toFixed(1)}㎍/㎥ ${gradeOf(sample.pm25).name}`,
      }))
    availability.addInterval(new Cesium.TimeInterval(opts))
  }

  // 시간에 따라 값이 변하는 라벨 마커
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(site.longitude, site.latitude, 10),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString(MAP_CONFIG.markers.observation),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: labelProp,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -18),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      showBackground: false,
    },
    name: site.siteName,
    description: buildDescription('관측값 시계열', null, undefined, site.latitude, site.longitude),
  })

  // 시간에 따라 색이 변하는 격자
  for (const pos of gridPositions(site.longitude, site.latitude)) {
    ds.entities.add({
      availability,
      position: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
      box: {
        dimensions: new Cesium.Cartesian3(
          MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxSize, MAP_CONFIG.grid.boxHeight),
        material: new Cesium.ColorMaterialProperty(colorProp),
        outline: pos.center,
        outlineColor: outlineProp,
      },
      name: `${site.siteName} 미세먼지 격자`,
      description: buildDescription('관측값 시계열', null, undefined, site.latitude, site.longitude),
    })
  }
}

/** Date → datetime-local 입력값 (로컬 타임존) */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`
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
  const [mode, setMode] = useState<'current' | 'series'>('current')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  /** 현재값 모드 데이터 로드 */
  const loadCurrent = async () => {
    const ds = dataSourcesRef.current
    const viewer = viewerRef.current
    if (!ds || !viewer) return
    setLoading(true)
    setError(null)
    try {
      const [obsRes, predRes, idwRes] = await Promise.all([
        apiClient.get<ApiResponse<VizPoint[]>>('/viz/observations/latest'),
        apiClient.get<ApiResponse<VizPoint[]>>('/viz/predictions/latest'),
        apiClient.get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=100'),
      ])
      Object.values(ds).forEach((d) => d.entities.removeAll())

      for (const o of obsRes.data.data) {
        addMarker(ds.observation, o.longitude, o.latitude, o.siteName,
          MAP_CONFIG.markers.observation,
          buildDescription('관측값', o.pm25, o.observedAt, o.latitude, o.longitude))
        addStaticGrid(ds.observation, o.longitude, o.latitude, o.pm25, o.siteName, '관측값')
      }
      for (const p of predRes.data.data) {
        addMarker(ds.prediction, p.longitude, p.latitude, `${p.siteName} (예측)`,
          MAP_CONFIG.markers.prediction,
          buildDescription('AI 예측값', p.pm25, p.predictedAt, p.latitude, p.longitude))
        addStaticGrid(ds.prediction, p.longitude, p.latitude, p.pm25, p.siteName, 'AI 예측값')
      }
      const seen = new Set<string>()
      for (const r of idwRes.data.data.content) {
        const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
        if (seen.has(key)) continue
        seen.add(key)
        const name = r.targetName ?? `보간지점 ${r.id}`
        addMarker(ds.interpolation, r.longitude, r.latitude, name,
          MAP_CONFIG.markers.interpolation,
          buildDescription('IDW 보간값', r.pm25, r.interpolatedAt, r.latitude, r.longitude))
        ds.interpolation.entities.add({
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
          description: buildDescription('IDW 보간값', r.pm25, r.interpolatedAt,
            r.latitude, r.longitude),
        })
      }
      viewer.clock.shouldAnimate = false
      setMode('current')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  /** 시계열 모드 데이터 로드 + Clock/Timeline 설정 */
  const loadSeries = async () => {
    const ds = dataSourcesRef.current
    const viewer = viewerRef.current
    if (!ds || !viewer || !from || !to) return
    setLoading(true)
    setError(null)
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(to).toISOString()
      const res = await apiClient.get<ApiResponse<SeriesSite[]>>(
        `/viz/observations/series?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
      if (res.data.data.length === 0) {
        setError('선택한 기간에 관측 데이터가 없습니다')
        return
      }

      // 시계열은 관측 레이어에 표시 (예측/보간 레이어는 최신값 유지)
      ds.observation.entities.removeAll()
      for (const site of res.data.data) {
        addTimeSeriesSite(ds.observation, site)
      }

      // Cesium Clock / Timeline 설정 (재생·일시정지·배속은 애니메이션 위젯 제공)
      const start = Cesium.JulianDate.fromIso8601(fromIso)
      const stop = Cesium.JulianDate.fromIso8601(toIso)
      viewer.clock.startTime = start.clone()
      viewer.clock.stopTime = stop.clone()
      viewer.clock.currentTime = start.clone()
      viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
      viewer.clock.multiplier = 900 // 1초당 15분 (1시간 데이터가 4초에 재생)
      viewer.clock.shouldAnimate = true
      viewer.timeline?.zoomTo(start, stop)
      setMode('series')
      setLayers((prev) => ({ ...prev, observation: true }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Viewer 생성 (1회)
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
    if (ionToken) Cesium.Ion.defaultAccessToken = ionToken

    const viewer = new Cesium.Viewer(containerRef.current, {
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
      animation: true, // 재생/일시정지/배속 위젯
      timeline: true,
      fullscreenButton: true,
    })
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.clock.shouldAnimate = false
    viewerRef.current = viewer

    const dataSources: Record<LayerKey, Cesium.CustomDataSource> = {
      observation: new Cesium.CustomDataSource('observation'),
      prediction: new Cesium.CustomDataSource('prediction'),
      interpolation: new Cesium.CustomDataSource('interpolation'),
    }
    Object.values(dataSources).forEach((d) => viewer.dataSources.add(d))
    dataSourcesRef.current = dataSources

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        MAP_CONFIG.initialView.longitude,
        MAP_CONFIG.initialView.latitude,
        MAP_CONFIG.initialView.height,
      ),
    })

    // 관측소 목록 + 시계열 기본 기간(데이터 범위 마지막 24시간) + 현재값 로드
    apiClient.get<ApiResponse<Site[]>>('/sites').then((res) => setSites(res.data.data))
    apiClient
      .get<ApiResponse<{ from: string | null; to: string | null }>>('/viz/observations/time-range')
      .then((res) => {
        const range = res.data.data
        if (range.to) {
          const end = new Date(range.to)
          const begin = new Date(Math.max(
            new Date(range.from ?? range.to).getTime(),
            end.getTime() - 24 * 3600 * 1000))
          setFrom(toLocalInput(begin))
          setTo(toLocalInput(end))
        }
      })
    loadCurrent()

    return () => {
      viewer.destroy()
      viewerRef.current = null
      dataSourcesRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* 시계열 컨트롤 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
        <span className="font-medium text-gray-700">시계열 재생</span>
        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
        <span className="text-gray-400">~</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
        <button
          onClick={loadSeries}
          disabled={loading || !from || !to}
          className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          시계열 로드
        </button>
        {mode === 'series' && (
          <button
            onClick={loadCurrent}
            disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-100"
          >
            현재값 보기
          </button>
        )}
        <span className="text-xs text-gray-400">
          {mode === 'series'
            ? '좌측 하단 위젯으로 재생·일시정지·배속, 하단 Timeline으로 시간 이동'
            : '기간 선택 후 [시계열 로드]를 누르면 시간 재생 모드로 전환됩니다'}
        </span>
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
