import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { WindLayer } from 'cesium-wind-layer'
import type { WindData } from 'cesium-wind-layer'
import { useEffect, useRef, useState } from 'react'
import { Clock, Info, Layers, MapPinned, Ruler } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import Hls from 'hls.js'
import {
  MapLegend, MapPanel, PanelField, PanelGroup, PanelSection,
} from '../components/map/panel'
import { Button, Toggle, selectClass } from '../components/ui'
import type {
  AdvectionResponse, AirAlert, ApiResponse, CctvCamera, CctvEstimate, CctvStreamsResponse,
  CurrentAirQuality, IdwGridResponse,
  InterpolationResult, Observation, OdorResponse, OdorSpot, PageResponse, PollutantValue,
  Prediction, PublicStationAir, Site, WeatherNow, WindFieldResponse,
} from '../api/client'
import { GRADES, gradeOf } from '../config/grades'
import { odorGradeOf } from '../config/odorGrades'
import { MAP_CONFIG, gridSettingsFor } from '../config/mapConfig'
import type { GridPresetKey, GridSettings } from '../config/mapConfig'
import {
  DISTRICT_VIEW_HEIGHT, INCHEON_CORE_DISTRICTS, INCHEON_FOCUS_VIEW,
  SIDO_CENTERS, SIDO_VIEW_HEIGHT,
} from '../config/sido'
import { summarizeAlertsByDistrict } from '../utils/alerts'
import type { DistrictAlertSummary } from '../utils/alerts'
import { interpolationSeries, predictionSeries } from '../utils/compareSeries'
import { pathDistanceKm, polygonAreaKm2 } from '../utils/geo'
import {
  DEFAULT_HUMIDITY, DEFAULT_TEMPERATURE, estimateBadgeText, nearestSite,
} from '../utils/cctvEstimate'
import {
  PUBLIC_GRADE_COLORS, PUBLIC_POLLUTANTS, VALUE_STATUS_LABELS,
  displayHeightM, publicGradeOf,
} from '../config/publicGrades'
import type { PublicPollutantKey } from '../config/publicGrades'

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

/** 공공 측정소 누적 시계열 (지도 재생용) — 백엔드 PublicStationSeries와 대응 */
interface PublicSeriesStation {
  stationName: string
  latitude: number
  longitude: number
  samples: { measuredAt: string; pm25: number; pm25Grade: string | null }[]
}

type LayerKey =
  | 'observation' | 'prediction' | 'interpolation' | 'airkorea' | 'idwSurface' | 'alertRegion'
  | 'odor' | 'wind' | 'advection' | 'cctv'

const LAYER_LABELS: Record<LayerKey, string> = {
  observation: '관측값',
  prediction: 'AI 예측값',
  interpolation: 'IDW 보간값',
  airkorea: '공공 대기질',
  idwSurface: '실측 IDW 표면',
  alertRegion: '경보 권역',
  odor: '악취 측정(인천)',
  wind: '바람길 (기상청 예보)',
  advection: 'PM2.5 이동 예측',
  cctv: '실시간 CCTV(인천 3구)',
}

/**
 * 레이어를 출처별로 묶는다.
 * 10개를 한 줄로 늘어놓으면 무엇이 우리 데이터고 무엇이 공공 데이터인지 구분되지 않는다.
 */
const LAYER_GROUPS: { label: string; keys: LayerKey[] }[] = [
  { label: '자체 데이터', keys: ['observation', 'prediction', 'interpolation', 'idwSurface'] },
  { label: '공공 데이터', keys: ['airkorea', 'odor', 'alertRegion', 'cctv'] },
  { label: '예측 시뮬레이션', keys: ['wind', 'advection'] },
]

/** 측정 도구 (보고서 §4.3.3: 거리·면적·고도) */
const MEASURE_TOOLS = [
  { key: 'distance', label: '거리', title: '좌클릭으로 지점을 추가하고 우클릭으로 끝냅니다.' },
  {
    key: 'area',
    label: '면적',
    title: '좌클릭으로 꼭짓점을 3개 이상 찍고 우클릭으로 끝냅니다.',
  },
  { key: 'height', label: '고도', title: '지점을 한 번 클릭하면 지형·객체 높이를 표시합니다.' },
] as const

/** 시계열 샘플 1건이 유효한 시간 길이 (시간 단위 관측 가정) */
const SAMPLE_DURATION_SEC = 3600

/** 공공 실측 시계열 막대 높이(m). 농도는 색으로 표현하므로 높이는 고정. */
const PUBLIC_SERIES_BAR_LENGTH_M = 2500

function pm25Color(pm25: number, alpha: number): Cesium.Color {
  return Cesium.Color.fromCssColorString(gradeOf(pm25).chart).withAlpha(alpha)
}

/** 마커 아이콘 표시 크기 (px) */
const MARKER_ICON_PX = 32

/**
 * 이모지 마커 아이콘: 배경 도형 없이 이모지만 캔버스에 그려 빌보드 이미지로 쓴다.
 * 위성 영상 등 어두운 배경에서도 잘 보이도록 흰 후광 + 옅은 그림자를 함께 그린다.
 */
const markerIconCache = new Map<string, HTMLCanvasElement>()
function markerIcon(emoji: string): HTMLCanvasElement {
  const cached = markerIconCache.get(emoji)
  if (cached) return cached
  const size = 72 // 고해상도 화면에서도 선명하도록 표시 크기의 2배 이상으로 그린다
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = `${Math.round(size * 0.7)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 흰 후광 (겹쳐 그려 어두운 배경에서 윤곽 강조)
    ctx.shadowColor = 'rgba(255,255,255,0.95)'
    ctx.shadowBlur = 8
    for (let i = 0; i < 3; i++) {
      ctx.fillText(emoji, size / 2, size / 2 + 2)
    }
    // 옅은 그림자 (밝은 배경에서 떠 보이게)
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 2
    ctx.fillText(emoji, size / 2, size / 2 + 2)
  }
  markerIconCache.set(emoji, canvas)
  return canvas
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
function gridPositions(lng: number, lat: number, g: GridSettings) {
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
                       name: string, type: string, g: GridSettings) {
  for (const pos of gridPositions(lng, lat, g)) {
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
      box: {
        dimensions: new Cesium.Cartesian3(g.boxSize, g.boxSize, g.boxHeight),
        material: pm25Color(pm25, MAP_CONFIG.boxAlpha),
        outline: pos.center,
        outlineColor: pm25Color(pm25, 0.8),
      },
      name: `${name} 미세먼지 격자`,
      description: buildDescription(type, pm25, undefined, lat, lng),
    })
  }
}

/** 지점 마커(이모지 아이콘+라벨) 추가. labelText에 Property를 주면 시간에 따라 변한다. */
function addMarker(ds: Cesium.CustomDataSource, lng: number, lat: number, name: string,
                   description: string,
                   labelText?: Cesium.Property | string,
                   emoji: string = MAP_CONFIG.markerEmojis.observation) {
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lng, lat, 10),
    billboard: {
      image: markerIcon(emoji),
      width: MARKER_ICON_PX,
      height: MARKER_ICON_PX,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: (labelText ?? name) as string,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -22),
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
function addTimeSeriesSite(ds: Cesium.CustomDataSource, site: SeriesSite, g: GridSettings,
                           seriesType: string = '관측값 시계열',
                           emoji: string = MAP_CONFIG.markerEmojis.observation) {
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
    billboard: {
      image: markerIcon(emoji),
      width: MARKER_ICON_PX,
      height: MARKER_ICON_PX,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: labelProp,
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -22),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      showBackground: false,
    },
    name: site.siteName,
    description: buildDescription(seriesType, null, undefined, site.latitude, site.longitude),
  })

  // 시간에 따라 색이 변하는 격자
  for (const pos of gridPositions(site.longitude, site.latitude, g)) {
    ds.entities.add({
      availability,
      position: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, pos.alt),
      box: {
        dimensions: new Cesium.Cartesian3(g.boxSize, g.boxSize, g.boxHeight),
        material: new Cesium.ColorMaterialProperty(colorProp),
        outline: pos.center,
        outlineColor: outlineProp,
      },
      name: `${site.siteName} 미세먼지 격자`,
      description: buildDescription(seriesType, null, undefined, site.latitude, site.longitude),
    })
  }
}

/** 공공 측정소 팝업(InfoBox) HTML: 전체 오염물질 + 상태 표 */
function buildPublicDescription(station: PublicStationAir): string {
  const row = (label: string, v: PollutantValue) => {
    const content = v.valid && v.value != null
      ? `<b>${v.value}</b> ${v.unit ?? ''} ${v.grade ? `(${v.grade})` : ''}`
      : `<span style="color:#999">${VALUE_STATUS_LABELS[v.status] ?? '데이터 없음'}</span>`
    return `<tr><th>${label}</th><td>${content}</td></tr>`
  }
  return `
    <table class="cesium-infoBox-defaultTable"><tbody>
      <tr><th>구분</th><td>공공 실측 (AirKorea)</td></tr>
      ${row('PM10', station.pm10)}
      ${row('PM2.5', station.pm25)}
      ${row('O₃', station.o3)}
      ${row('NO₂', station.no2)}
      ${row('CO', station.co)}
      ${row('SO₂', station.so2)}
      ${row('통합지수', station.khai)}
      <tr><th>측정시간</th><td>${station.measuredAt ? new Date(station.measuredAt).toLocaleString('ko-KR') : '-'}</td></tr>
      <tr><th>출처</th><td>환경부·한국환경공단 AirKorea</td></tr>
    </tbody></table>`
}

/**
 * 공공 측정소 1곳 표시: 농도 막대(원기둥) + 마커/라벨.
 * 막대 높이는 농도 비교용 정규화 값이며 실제 오염층 높이가 아니다 (화면 안내 문구 참조).
 */
function addPublicStation(ds: Cesium.CustomDataSource, station: PublicStationAir,
                          pollutant: PublicPollutantKey) {
  if (!station.locationAvailable || station.latitude == null || station.longitude == null) return
  const v = station[pollutant]
  const description = buildPublicDescription(station)
  const config = PUBLIC_POLLUTANTS.find((p) => p.key === pollutant)!

  if (v.valid && v.value != null) {
    const grade = v.grade ?? publicGradeOf(pollutant, v.value)
    const color = Cesium.Color.fromCssColorString(
      PUBLIC_GRADE_COLORS[grade] ?? PUBLIC_GRADE_COLORS['데이터 없음'])
    const height = displayHeightM(pollutant, v.value)
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, height / 2),
      cylinder: {
        length: height,
        topRadius: MAP_CONFIG.publicBar.radius,
        bottomRadius: MAP_CONFIG.publicBar.radius,
        material: color.withAlpha(MAP_CONFIG.publicBar.alpha),
        outline: true,
        outlineColor: color.withAlpha(0.9),
      },
      name: `${station.stationName} (공공 실측)`,
      description,
    })
    // 농도 값 + 텍스트 등급을 라벨에 함께 표기 (색상만으로 상태를 구분하지 않음)
    addMarker(ds, station.longitude, station.latitude, `${station.stationName} (공공 실측)`,
      description, `${station.stationName}\n${v.value}${config.unit} ${grade}`,
      MAP_CONFIG.markerEmojis.airkorea)
  } else {
    // 데이터 없음/장애 측정소: 사유 텍스트 라벨 (오류처럼 보이지 않게)
    addMarker(ds, station.longitude, station.latitude, `${station.stationName} (공공 실측)`,
      description, `${station.stationName}\n△ ${VALUE_STATUS_LABELS[v.status] ?? '데이터 없음'}`,
      MAP_CONFIG.markerEmojis.airkorea)
  }
}

/**
 * 풍향 화살표 추가. 기상청 풍향(VEC)은 바람이 불어오는 방향이므로
 * 백엔드가 이동 방향(windArrowDegree)으로 변환한 값을 사용한다.
 */
function addWindArrow(ds: Cesium.CustomDataSource, lat: number, lng: number,
                      weather: WeatherNow) {
  if (weather.windArrowDegree == null || weather.windSpeed == null) return
  const cfg = MAP_CONFIG.windArrow
  // 풍속에 비례한 화살표 길이 (최소 0.6배 ~ 최대 2배)
  const scale = Math.min(Math.max(weather.windSpeed / 4, 0.6), 2)
  const lengthM = cfg.lengthM * scale
  const rad = (weather.windArrowDegree * Math.PI) / 180
  const mPerDegLat = 111_320
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180)
  const endLat = lat + (lengthM * Math.cos(rad)) / mPerDegLat
  const endLng = lng + (lengthM * Math.sin(rad)) / mPerDegLng
  const color = Cesium.Color.fromCssColorString(cfg.color)
  ds.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lng, lat, cfg.altitudeM, endLng, endLat, cfg.altitudeM,
      ]),
      width: 14,
      material: new Cesium.PolylineArrowMaterialProperty(color),
      clampToGround: false,
    },
    name: '바람 (기상청)',
    description: `
      <table class="cesium-infoBox-defaultTable"><tbody>
        <tr><th>풍향</th><td>${weather.windDirectionText ?? '-'} (${weather.windDirectionDegree ?? '-'}°에서 불어옴)</td></tr>
        <tr><th>풍속</th><td>${weather.windSpeed} m/s</td></tr>
        <tr><th>기온</th><td>${weather.temperature ?? '-'} ℃</td></tr>
        <tr><th>습도</th><td>${weather.humidity ?? '-'} %</td></tr>
        <tr><th>강수형태</th><td>${weather.precipitationType ?? '-'}</td></tr>
        <tr><th>출처</th><td>기상청 (화살표는 바람의 이동 방향)</td></tr>
      </tbody></table>`,
  })
}

/** 공공 실측 IDW 격자 표면: 셀별 색상 상자로 타일링 (높이 아닌 색으로 농도 표현). */
function addIdwSurface(ds: Cesium.CustomDataSource, grid: IdwGridResponse) {
  const n = grid.resolution
  const cellLatDeg = (grid.bbox.maxLatitude - grid.bbox.minLatitude) / n
  const cellLonDeg = (grid.bbox.maxLongitude - grid.bbox.minLongitude) / n
  const mPerDegLat = 111_320
  for (const c of grid.cells) {
    const mPerDegLon = 111_320 * Math.cos((c.latitude * Math.PI) / 180)
    const color = Cesium.Color.fromCssColorString(
      PUBLIC_GRADE_COLORS[c.grade] ?? gradeOf(c.pm25).chart).withAlpha(0.45)
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(c.longitude, c.latitude, 40),
      box: {
        dimensions: new Cesium.Cartesian3(cellLonDeg * mPerDegLon, cellLatDeg * mPerDegLat, 60),
        material: color,
      },
      name: `실측 IDW 표면`,
      description: `<table class="cesium-infoBox-defaultTable"><tbody>
        <tr><th>보간 PM2.5</th><td><b>${c.pm25.toFixed(1)}</b> ㎍/㎥ (${c.grade})</td></tr>
        <tr><th>좌표</th><td>${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}</td></tr>
        <tr><th>방식</th><td>AirKorea 실측 ${grid.sourceCount}곳 IDW (색으로 농도 표현)</td></tr>
        </tbody></table>`,
    })
  }
}

/** 백엔드 바람장 시각 1개 → cesium-wind-layer 입력 형식 */
function toWindData(field: WindFieldResponse, hourIndex: number): WindData {
  const h = field.hours[hourIndex]
  return {
    u: { array: new Float32Array(h.u), min: Math.min(...h.u), max: Math.max(...h.u) },
    v: { array: new Float32Array(h.v), min: Math.min(...h.v), max: Math.max(...h.v) },
    width: field.width,
    height: field.height,
    bounds: field.bounds,
  }
}

/** 이동 방향(도, 북=0 시계방향) → 16방위 텍스트 */
const DIRECTIONS_16 = [
  '북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
  '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서',
] as const
function headingText16(deg: number): string {
  return DIRECTIONS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]
}

/** 풍속 → 파티클 색상 램프와 동일한 색 (화살표·파티클 색 기준 통일) */
function windSpeedColor(speedMs: number, alpha: number): Cesium.Color {
  const colors = MAP_CONFIG.windLayer.colors
  const t = Math.min(speedMs / MAP_CONFIG.windArrowGrid.refSpeedMs, 0.999)
  return Cesium.Color.fromCssColorString(
    colors[Math.floor(t * colors.length)]).withAlpha(alpha)
}

/**
 * 바람장 격자를 균등 샘플링해 이동 방향 화살표를 그린다.
 * 파티클은 움직임(애니메이션), 화살표는 방향·세기(정적)를 담당해
 * 한눈에 바람 흐름을 읽을 수 있게 한다.
 */
function addWindArrows(ds: Cesium.CustomDataSource, field: WindFieldResponse,
                       hourIndex: number) {
  ds.entities.removeAll()
  const hour = field.hours[Math.min(hourIndex, field.hours.length - 1)]
  if (!hour) return
  const cfg = MAP_CONFIG.windArrowGrid
  const step = Math.max(1, Math.round(field.width / cfg.perAxis))
  const cellLatDeg = (field.bounds.north - field.bounds.south) / field.height
  const cellLonDeg = (field.bounds.east - field.bounds.west) / field.width
  for (let row = Math.floor(step / 2); row < field.height; row += step) {
    const lat = field.bounds.south + (row + 0.5) * cellLatDeg
    const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180)
    for (let col = Math.floor(step / 2); col < field.width; col += step) {
      const idx = row * field.width + col
      const u = hour.u[idx]
      const v = hour.v[idx]
      const speed = Math.hypot(u, v)
      if (speed < cfg.minSpeedMs) continue
      const lon = field.bounds.west + (col + 0.5) * cellLonDeg
      const lengthM = cfg.minLengthM
        + (cfg.maxLengthM - cfg.minLengthM) * Math.min(speed / cfg.refSpeedMs, 1)
      // (u,v)는 동·북 방향 이동 성분 → 셀 중심을 기준으로 앞뒤 절반씩 벌린다
      const dLat = (v / speed) * lengthM / 111_320
      const dLon = (u / speed) * lengthM / mPerDegLon
      const headingDeg = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360
      ds.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            lon - dLon / 2, lat - dLat / 2, cfg.altitudeM,
            lon + dLon / 2, lat + dLat / 2, cfg.altitudeM,
          ]),
          width: cfg.widthPx,
          material: new Cesium.PolylineArrowMaterialProperty(
            windSpeedColor(speed, cfg.alpha)),
        },
        name: '바람 이동 방향',
        description: `<table class="cesium-infoBox-defaultTable"><tbody>
          <tr><th>풍속</th><td><b>${speed.toFixed(1)}</b> m/s</td></tr>
          <tr><th>이동 방향</th><td>${headingText16(headingDeg)}쪽 (${headingDeg.toFixed(0)}°)</td></tr>
          <tr><th>예보 시각</th><td>${new Date(hour.time).toLocaleString('ko-KR')}</td></tr>
          <tr><th>출처</th><td>기상청 초단기예보 바람장 (중부권 서해~동해 격자)</td></tr>
          </tbody></table>`,
      })
    }
  }
}

/** PM2.5 농도 → 등급색 사이를 연속 보간한 색 (등급 대역 중앙 = 순수 등급색).
 *  좁은 농도 범위에서도 셀 간 차이가 색으로 드러나도록 이산 등급색 대신 그라데이션을 쓴다. */
const PM25_RAMP_STOPS: Array<[number, string]> = [
  [7.5, GRADES[0].chart],   // 좋음(0~15) 중앙
  [25, GRADES[1].chart],    // 보통(15~35) 중앙
  [55, GRADES[2].chart],    // 나쁨(35~75) 중앙
  [90, GRADES[3].chart],    // 매우나쁨(75~) 대표값
]
function pm25RampColor(pm25: number, alpha: number): Cesium.Color {
  const stops = PM25_RAMP_STOPS
  if (pm25 <= stops[0][0]) return Cesium.Color.fromCssColorString(stops[0][1]).withAlpha(alpha)
  for (let i = 1; i < stops.length; i++) {
    if (pm25 <= stops[i][0]) {
      const t = (pm25 - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      return Cesium.Color.lerp(
        Cesium.Color.fromCssColorString(stops[i - 1][1]),
        Cesium.Color.fromCssColorString(stops[i][1]),
        t, new Cesium.Color()).withAlpha(alpha)
    }
  }
  return Cesium.Color.fromCssColorString(stops[stops.length - 1][1]).withAlpha(alpha)
}

/**
 * 이류 예측 프레임 1개를 3D 농도 기둥으로 렌더.
 * 높이·색이 농도에 비례하고 기둥 사이 틈으로 지도가 보여,
 * 슬라이더를 움직이면 농도 덩어리가 바람을 따라 이동하는 모습이 입체적으로 읽힌다.
 */
function addAdvectionFrame(ds: Cesium.CustomDataSource, resp: AdvectionResponse,
                           frameIndex: number) {
  ds.entities.removeAll()
  const frame = resp.frames[Math.min(frameIndex, resp.frames.length - 1)]
  if (!frame) return
  const cfg = MAP_CONFIG.advectionGrid
  const cellLatDeg = (resp.bounds.north - resp.bounds.south) / resp.height
  const cellLonDeg = (resp.bounds.east - resp.bounds.west) / resp.width
  const mPerDegLat = 111_320
  const timeText = new Date(frame.time).toLocaleString('ko-KR')
  for (let row = 0; row < resp.height; row++) {
    const lat = resp.bounds.south + (row + 0.5) * cellLatDeg
    const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180)
    for (let col = 0; col < resp.width; col++) {
      const pm25 = frame.pm25[row * resp.width + col]
      const pm10 = frame.pm10 ? frame.pm10[row * resp.width + col] : null
      const lon = resp.bounds.west + (col + 0.5) * cellLonDeg
      const heightM = Math.min(
        Math.max(pm25 * cfg.heightPerUnit, cfg.minHeightM), cfg.maxHeightM)
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, heightM / 2),
        box: {
          dimensions: new Cesium.Cartesian3(
            cellLonDeg * mPerDegLon * cfg.footprintRatio,
            cellLatDeg * mPerDegLat * cfg.footprintRatio, heightM),
          material: pm25RampColor(pm25, cfg.alpha),
        },
        name: 'PM2.5 이동 예측',
        description: `<table class="cesium-infoBox-defaultTable"><tbody>
          <tr><th>예측 PM2.5</th><td><b>${pm25.toFixed(1)}</b> ㎍/㎥ (${gradeOf(pm25).name})</td></tr>
          ${pm10 != null ? `<tr><th>예측 PM10</th><td><b>${pm10.toFixed(1)}</b> ㎍/㎥</td></tr>` : ''}
          <tr><th>예측 시각</th><td>${timeText}</td></tr>
          <tr><th>표현</th><td>기둥 높이·색 = 예측 농도</td></tr>
          <tr><th>방식</th><td>단순 이류 추정 (바람 이동만 반영, 확산·배출 미포함)</td></tr>
          </tbody></table>`,
      })
    }
  }
}

/** 실시간 CCTV 카메라 마커. 클릭 시 InfoBox 대신 재생 모달을 연다 (selectedEntityChanged에서 처리) */
function addCctvCamera(ds: Cesium.CustomDataSource, cam: CctvCamera, mock: boolean) {
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(cam.longitude, cam.latitude, 25),
    billboard: {
      image: markerIcon(MAP_CONFIG.markerEmojis.cctv),
      width: MARKER_ICON_PX,
      height: MARKER_ICON_PX,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
    },
    label: {
      text: cam.name.replace(/^\[Mock\] /, ''),
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 60_000),
    },
    name: `${cam.name} (CCTV)`,
    properties: { cctvCamera: cam, cctvMock: mock },
  })
}

/** 비디오 현재 프레임을 JPEG Blob으로 캡처. 준비 전·보안 제한 시 오류를 던진다 */
function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      reject(new Error('영상이 아직 준비되지 않았습니다. 재생 시작 후 다시 시도해 주세요.'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('캔버스를 생성할 수 없습니다'))
      return
    }
    ctx.drawImage(video, 0, 0)
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('프레임 캡처에 실패했습니다'))),
        'image/jpeg', 0.85)
    } catch {
      // Safari 네이티브 HLS 등 교차 출처 직접 재생은 캔버스가 오염되어 내보내기가 차단된다
      reject(new Error('이 브라우저에서는 보안 제한으로 화면 캡처를 지원하지 않습니다'))
    }
  })
}

/** Mock 모드 시연용 합성 하늘 이미지 (저장소에 바이너리를 추가하지 않기 위해 캔버스로 생성) */
function sampleSkyImageBlob(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('캔버스를 생성할 수 없습니다'))
      return
    }
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
    sky.addColorStop(0, '#6ea8dc')
    sky.addColorStop(0.65, '#c9dcec')
    sky.addColorStop(1, '#e6e2d8')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#7d838a'
    ctx.fillRect(0, 320, canvas.width, 40)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('샘플 이미지 생성에 실패했습니다'))),
      'image/jpeg', 0.85)
  })
}

/** 실시간 CCTV 재생 모달 (HLS). 확대/축소 토글 + 전체화면 + 현재 프레임 미세먼지 추정 */
function CctvPlayerModal({ camera, mock, sites, onEstimated, onClose }: {
  camera: CctvCamera
  mock: boolean
  sites: Site[]
  onEstimated: (camera: CctvCamera, estimate: CctvEstimate) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [large, setLarge] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<CctvEstimate | null>(null)
  const [estimateNote, setEstimateNote] = useState<string | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  // 카메라를 바꿔 열면 이전 추정 결과를 비운다
  useEffect(() => {
    setEstimate(null)
    setEstimateNote(null)
    setEstimateError(null)
  }, [camera])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !camera.streamUrl) return
    setStreamError(null)
    // HLS 네이티브 지원 브라우저(최신 Chromium·Safari)는 src 직접 재생.
    // 교차 출처 스트림을 crossOrigin 없이 재생하면 캔버스가 오염되어 화면 캡처
    // (미세먼지 추정)가 SecurityError로 막히므로 CORS 모드로 받는다
    // (ITS 스트림 서버는 Access-Control-Allow-Origin: * 응답 확인).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.crossOrigin = 'anonymous'
      video.src = camera.streamUrl
      video.play().catch(() => {})
      // CORS를 지원하지 않는 스트림이면 crossOrigin 없이 1회 재시도해
      // 재생만이라도 되게 한다 (이 경우 캡처는 기존 보안 제한 안내로 처리).
      const retryWithoutCors = () => {
        if (video.crossOrigin !== 'anonymous') return
        video.crossOrigin = null
        video.src = camera.streamUrl!
        video.load()
        video.play().catch(() => {})
      }
      video.addEventListener('error', retryWithoutCors)
      return () => {
        video.removeEventListener('error', retryWithoutCors)
        video.removeAttribute('src')
        video.load()
      }
    }
    if (!Hls.isSupported()) {
      setStreamError('이 브라우저에서는 HLS 스트림 재생을 지원하지 않습니다')
      return
    }
    const hls = new Hls()
    hls.loadSource(camera.streamUrl)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {})
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setStreamError('스트림을 재생할 수 없습니다 (네트워크 또는 스트림 오류)')
      }
    })
    return () => hls.destroy()
  }, [camera])

  /** 재생 중 화면이 있으면 현재 프레임, 없으면(Mock) 합성 샘플 이미지로 즉시 추정 */
  const canCapture = !!camera.streamUrl && !streamError
  const runEstimate = async () => {
    setEstimating(true)
    setEstimate(null)
    setEstimateNote(null)
    setEstimateError(null)
    try {
      const video = videoRef.current
      const usingSample = !canCapture || !video
      const image = video && !usingSample
        ? await captureVideoFrame(video)
        : await sampleSkyImageBlob()
      const site = nearestSite(sites, camera.latitude, camera.longitude)
      if (!site) throw new Error('추정에 사용할 관측소가 없습니다')
      // 온·습도는 최근접 관측소의 최신 관측값을 자동 사용, 없으면 기본값으로 진행
      let temperature = DEFAULT_TEMPERATURE
      let humidity = DEFAULT_HUMIDITY
      let usedDefaults = true
      try {
        const obsRes = await apiClient.get<ApiResponse<PageResponse<Observation>>>(
          `/observations?siteId=${site.id}&size=1`)
        const latest = obsRes.data.data.content[0]
        if (latest?.temperature != null && latest?.humidity != null) {
          temperature = latest.temperature
          humidity = latest.humidity
          usedDefaults = false
        }
      } catch {
        // 관측 조회 실패는 기본값으로 대체하고 추정은 계속한다
      }
      const form = new FormData()
      form.append('siteId', String(site.id))
      form.append('image', image, 'cctv-frame.jpg')
      form.append('temperature', String(temperature))
      form.append('humidity', String(humidity))
      const res = await apiClient.post<ApiResponse<CctvEstimate>>('/predictions/cctv', form)
      const est = res.data.data
      setEstimate(est)
      setEstimateNote([
        usingSample ? '샘플 이미지 시연' : '현재 화면 캡처',
        `기준 관측소 ${site.name}`,
        usedDefaults
          ? `온습도 기본값 ${DEFAULT_TEMPERATURE}℃/${DEFAULT_HUMIDITY}%`
          : `온도 ${temperature}℃ · 습도 ${humidity}%`,
      ].join(' · '))
      onEstimated(camera, est)
    } catch (err) {
      setEstimateError(
        err instanceof Error && err.name !== 'AxiosError' ? err.message : errorMessage(err))
    } finally {
      setEstimating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-card border border-line bg-surface p-4 shadow-panel ${large ? 'max-w-6xl' : 'max-w-2xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">📹 {camera.name}</h3>
            <p className="text-xs text-ink-faint">
              {camera.district} · ITS 국가교통정보센터 실시간 도로 CCTV
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" onClick={() => setLarge(!large)}>
              {large ? '창 축소' : '창 확대'}
            </Button>
            <Button
              size="sm"
              onClick={() => videoRef.current?.requestFullscreen().catch(() => {})}
            >
              전체화면
            </Button>
            <Button size="sm" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
        {camera.streamUrl && !streamError ? (
          <video
            ref={videoRef}
            controls
            muted
            autoPlay
            playsInline
            className="aspect-video w-full rounded-control bg-black"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-control bg-gray-900 px-6 text-center text-sm text-gray-300">
            {streamError ?? (mock
              ? 'Mock 모드입니다. 실제 CCTV 영상은 .env에 ITS_CCTV_KEY 설정 후 표시됩니다.'
              : '이 카메라의 스트림 주소가 제공되지 않았습니다.')}
          </div>
        )}
        <div className="mt-3">
          <Button variant="primary" onClick={runEstimate} disabled={estimating}>
            {estimating
              ? '추정 중…'
              : canCapture ? '이 화면으로 미세먼지 추정' : '샘플 이미지로 추정 시연'}
          </Button>
          {estimateError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{estimateError}</p>
          )}
          {estimate && (
            <div className="mt-3 rounded-control border border-line bg-surface-muted p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                {estimate.pm25 != null ? (
                  <>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeOf(estimate.pm25).badge}`}>
                      {estimate.grade ?? gradeOf(estimate.pm25).name}
                    </span>
                    <span className="num font-semibold">PM2.5 {estimate.pm25.toFixed(1)} ㎍/㎥</span>
                  </>
                ) : (
                  <span>PM2.5 추정값 없음</span>
                )}
                {estimate.pm10 != null && <span>PM10 {estimate.pm10.toFixed(1)} ㎍/㎥</span>}
                {estimate.visibilityKm != null && (
                  <span>가시거리 약 {estimate.visibilityKm.toFixed(1)} km</span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">
                {estimate.mode === 'STATION_FALLBACK'
                  ? `야간(태양고도 ${estimate.solarElevationDeg.toFixed(1)}°) — 최근접 실측 대체`
                    + (estimate.stationName ? ` (${estimate.stationName} 측정소)` : '')
                  : `AI 이미지 추론 (${estimate.modelName})`}
                {estimateNote ? ` · ${estimateNote}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ALERT_ITEM_LABELS: Record<string, string> = {
  PM10: '미세먼지', PM25: '초미세먼지', O3: '오존',
}

/**
 * 경보 발령 시도 강조: 시도 중심에 반투명 원 + 라벨.
 * 경보 데이터는 시군구가 아닌 시도(districtName) 단위이므로 시도 대표좌표로 강조한다.
 */
function addAlertRegion(ds: Cesium.CustomDataSource, summary: DistrictAlertSummary) {
  const center = SIDO_CENTERS.find((c) => c.name === summary.district)
  if (!center) return
  const cfg = MAP_CONFIG.alertRegion
  const css = summary.maxLevel === '경보' ? cfg.warningColor : cfg.watchColor
  const color = Cesium.Color.fromCssColorString(css)
  const items = summary.items.map((c) => ALERT_ITEM_LABELS[c] ?? c).join('·')
  const text = `⚠ ${summary.district} ${items} ${summary.maxLevel} 발령`
  const description = `
    <table class="cesium-infoBox-defaultTable"><tbody>
      <tr><th>구분</th><td>대기오염 경보 (AirKorea)</td></tr>
      <tr><th>시도</th><td>${summary.district}</td></tr>
      <tr><th>발령 단계</th><td>${summary.maxLevel}</td></tr>
      <tr><th>항목</th><td>${items || '-'}</td></tr>
      <tr><th>활성 경보 수</th><td>${summary.count}건</td></tr>
      <tr><th>출처</th><td>환경부·한국환경공단 AirKorea (경보는 시도/예보권역 단위)</td></tr>
    </tbody></table>`
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, cfg.altitudeM),
    ellipse: {
      semiMajorAxis: cfg.radiusM,
      semiMinorAxis: cfg.radiusM,
      height: cfg.altitudeM,
      material: color.withAlpha(cfg.alpha),
      outline: true,
      outlineColor: color.withAlpha(0.85),
      outlineWidth: 2,
    },
    label: {
      text,
      font: 'bold 14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.fromCssColorString('#7f1d1d'),
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -8),
      showBackground: true,
      backgroundColor: color.withAlpha(0.85),
    },
    name: `${summary.district} 경보 권역`,
    description,
  })
}

/**
 * 악취 측정지점 마커: 등급색 포인트 + "지점명 N배" 라벨.
 * 자료는 인천환경공단 사업소 주변 복합악취(희석배수) 측정으로, 연 단위 개방(실시간 아님).
 */
function addOdorSpot(ds: Cesium.CustomDataSource, spot: OdorSpot, mock: boolean) {
  if (!spot.locationAvailable || spot.latitude == null || spot.longitude == null) return
  const dilution = spot.latestDilution
  const grade = dilution != null ? odorGradeOf(dilution) : null
  const valueText = dilution != null ? `${dilution}배` : '값 없음'
  const description = `
    <table class="cesium-infoBox-defaultTable"><tbody>
      <tr><th>구분</th><td>악취 측정 (복합악취 희석배수)${mock ? ' · Mock 데이터' : ''}</td></tr>
      <tr><th>관할 사업소</th><td>${spot.office}</td></tr>
      <tr><th>주소</th><td>${spot.address ?? '-'}</td></tr>
      <tr><th>최근 측정</th><td>${spot.latestDate ?? '-'} · <b>${valueText}</b>${grade ? ` (${grade.name})` : ''}</td></tr>
      <tr><th>최대값 / 측정 수</th><td>${spot.maxDilution ?? '-'}배 / ${spot.measurementCount}회</td></tr>
      <tr><th>기준</th><td>악취방지법 부지경계 배출허용기준: 기타 지역 15배, 공업 지역 20배</td></tr>
      <tr><th>출처</th><td>인천환경공단 (공공데이터포털, 연 단위 개방 자료)</td></tr>
    </tbody></table>`
  ds.entities.add({
    position: Cesium.Cartesian3.fromDegrees(spot.longitude, spot.latitude, 20),
    billboard: {
      image: markerIcon(MAP_CONFIG.markerEmojis.odor),
      width: MARKER_ICON_PX,
      height: MARKER_ICON_PX,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
    },
    label: {
      text: `${spot.spotName} ${valueText}`,
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80_000),
    },
    name: `${spot.spotName} (악취)`,
    description,
  })
}

/**
 * 공공 측정소 1곳의 누적 시계열을 색이 변하는 원기둥 + 라벨로 표시.
 * 농도는 색(등급)으로 표현하며, 데이터 없는 시간은 availability로 숨긴다.
 */
function addPublicTimeSeries(ds: Cesium.CustomDataSource, station: PublicSeriesStation) {
  const colorProp = new Cesium.TimeIntervalCollectionProperty()
  const outlineProp = new Cesium.TimeIntervalCollectionProperty()
  const labelProp = new Cesium.TimeIntervalCollectionProperty()
  const availability = new Cesium.TimeIntervalCollection()

  for (const sample of station.samples) {
    const start = Cesium.JulianDate.fromIso8601(sample.measuredAt)
    const stop = Cesium.JulianDate.addSeconds(start, SAMPLE_DURATION_SEC, new Cesium.JulianDate())
    const opts = { start, stop, isStartIncluded: true, isStopIncluded: false }
    const grade = sample.pm25Grade ?? publicGradeOf('pm25', sample.pm25)
    const css = PUBLIC_GRADE_COLORS[grade] ?? PUBLIC_GRADE_COLORS['데이터 없음']
    const color = Cesium.Color.fromCssColorString(css)
    colorProp.intervals.addInterval(
      new Cesium.TimeInterval({ ...opts, data: color.withAlpha(MAP_CONFIG.publicBar.alpha) }))
    outlineProp.intervals.addInterval(
      new Cesium.TimeInterval({ ...opts, data: color.withAlpha(0.9) }))
    labelProp.intervals.addInterval(
      new Cesium.TimeInterval({
        ...opts,
        data: `${station.stationName}\n${sample.pm25.toFixed(1)}㎍/㎥ ${grade}`,
      }))
    availability.addInterval(new Cesium.TimeInterval(opts))
  }

  const length = PUBLIC_SERIES_BAR_LENGTH_M
  // 색이 시간에 따라 변하는 농도 막대 (높이는 고정, 농도는 색으로 표현)
  ds.entities.add({
    availability,
    position: Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, length / 2),
    cylinder: {
      length,
      topRadius: MAP_CONFIG.publicBar.radius,
      bottomRadius: MAP_CONFIG.publicBar.radius,
      material: new Cesium.ColorMaterialProperty(colorProp),
      outline: true,
      outlineColor: outlineProp,
    },
    name: `${station.stationName} (공공 실측 시계열)`,
    description: buildDescription('공공 실측 시계열', null, undefined,
      station.latitude, station.longitude),
  })
  // 시간에 따라 값이 변하는 라벨 마커
  ds.entities.add({
    availability,
    position: Cesium.Cartesian3.fromDegrees(station.longitude, station.latitude, 10),
    billboard: {
      image: markerIcon(MAP_CONFIG.markerEmojis.airkorea),
      width: MARKER_ICON_PX,
      height: MARKER_ICON_PX,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: labelProp,
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -22),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      showBackground: false,
    },
    name: `${station.stationName} (공공 실측 시계열)`,
    description: buildDescription('공공 실측 시계열', null, undefined,
      station.latitude, station.longitude),
  })
}

/** 공공 현재값 airkorea 레이어 렌더링 (측정소 막대 + 지역 풍향). 현재값 모드에서 재사용. */
function renderAirkoreaCurrentLayer(ds: Cesium.CustomDataSource,
                                    air: CurrentAirQuality, pollutant: PublicPollutantKey,
                                    weather: WeatherNow | null) {
  ds.entities.removeAll()
  for (const station of air.stations) {
    addPublicStation(ds, station, pollutant)
  }
  if (weather) {
    const located = air.stations.filter((s) => s.locationAvailable)
    if (located.length > 0) {
      const centerLat = located.reduce((a, s) => a + (s.latitude ?? 0), 0) / located.length
      const centerLng = located.reduce((a, s) => a + (s.longitude ?? 0), 0) / located.length
      addWindArrow(ds, centerLat, centerLng, weather)
    }
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
  const compareContainerRef = useRef<HTMLDivElement>(null)
  const measureDsRef = useRef<Cesium.CustomDataSource | null>(null)
  const measurePointsRef = useRef<{ latitude: number; longitude: number }[]>([])
  /** 듀얼맵 비교 뷰가 effect 재실행 없이 최신 관측소 목록을 읽기 위한 미러 */
  const sitesRef = useRef<Site[]>([])

  const [sites, setSites] = useState<Site[]>([])
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    observation: true,
    prediction: true,
    interpolation: true,
    airkorea: true,
    idwSurface: false,
    alertRegion: true,
    odor: true,
    wind: true,
    // 이동 예측은 기둥이 화면을 가릴 수 있어 기본 꺼짐 — 필요할 때 켠다 (2026-07-25 사용자 피드백)
    advection: false,
    cctv: true,
  })
  const [mode, setMode] = useState<'current' | 'series'>('current')
  const [dualMode, setDualMode] = useState(false)
  /** 시계열 재로드 시 증가 — 듀얼맵 비교 뷰가 새 기간을 다시 그리도록 하는 신호 */
  const [seriesKey, setSeriesKey] = useState(0)
  /** 측정 도구 (보고서 §4.3.3: 거리·면적·고도) — null이면 측정 꺼짐 */
  const [measureTool, setMeasureTool] = useState<'distance' | 'area' | 'height' | null>(null)
  /** 입체격자 세밀도 (상세 = 보고서 §3.1.2 규격 7×7×3) */
  const [gridPreset, setGridPreset] = useState<GridPresetKey>('basic')
  const gridCfg = gridSettingsFor(gridPreset)
  const [baseMap, setBaseMap] = useState<'osm' | 'satellite'>(
    (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) ? 'satellite' : 'osm')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pollutant, setPollutant] = useState<PublicPollutantKey>('pm25')
  const [publicAir, setPublicAir] = useState<CurrentAirQuality | null>(null)
  const [publicError, setPublicError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherNow | null>(null)
  const [selectedSido, setSelectedSido] = useState('')
  const windLayerRef = useRef<WindLayer | null>(null)
  const [windField, setWindField] = useState<WindFieldResponse | null>(null)
  const [advection, setAdvection] = useState<AdvectionResponse | null>(null)
  /** 0 = +1시간 예보 … 5 = +6시간 예보 */
  const [hourOffset, setHourOffset] = useState(0)
  /** 관측소 이동 드롭다운 선택값 (최초 로드 시 연수송도 자동 선택) */
  const [selectedSiteId, setSelectedSiteId] = useState('')
  /** CCTV 마커 클릭으로 열린 재생 대상 */
  const [cctvPlayback, setCctvPlayback] =
    useState<{ camera: CctvCamera; mock: boolean } | null>(null)

  /** 공공(AirKorea) 실시간 대기질 + 지역 기상 로드 — 자체 데이터 오류와 분리해 처리 */
  const loadPublicAir = async (sido?: string) => {
    setPublicError(null)
    try {
      const q = sido ? `?sido=${encodeURIComponent(sido)}` : ''
      const res = await apiClient.get<ApiResponse<CurrentAirQuality>>(`/air-quality/current${q}`)
      const data = res.data.data
      setPublicAir(data)
      // 최초 로드 시 드롭다운을 백엔드가 해석한 실제 시도로 동기화
      setSelectedSido((prev) => prev || data.sido)
      // 좌표 있는 측정소들의 중심점 기준 기상 조회 (기상 실패는 무시하고 대기질만 표시)
      const located = data.stations.filter((s) => s.locationAvailable)
      if (located.length > 0) {
        const centerLat = located.reduce((a, s) => a + (s.latitude ?? 0), 0) / located.length
        const centerLng = located.reduce((a, s) => a + (s.longitude ?? 0), 0) / located.length
        try {
          const w = await apiClient.get<ApiResponse<WeatherNow>>(
            `/weather/current?latitude=${centerLat.toFixed(5)}&longitude=${centerLng.toFixed(5)}`)
          setWeather(w.data.data)
        } catch {
          setWeather(null)
        }
      }
    } catch (err) {
      setPublicAir(null)
      setPublicError(errorMessage(err))
    }
  }

  /** 활성 대기오염 경보 로드 → 발령 시도 강조 (실패해도 다른 레이어 무영향) */
  const loadAlerts = async () => {
    const ds = dataSourcesRef.current
    if (!ds) return
    try {
      const res = await apiClient.get<ApiResponse<AirAlert[]>>('/air-quality/alerts/active')
      if (dataSourcesRef.current !== ds) return // 응답 대기 중 재마운트 시 중단
      ds.alertRegion.entities.removeAll()
      for (const summary of summarizeAlertsByDistrict(res.data.data)) {
        addAlertRegion(ds.alertRegion, summary)
      }
    } catch {
      ds.alertRegion.entities.removeAll()
    }
  }

  /** 악취 측정 현황 로드 → 측정지점 마커 (실패해도 다른 레이어 무영향) */
  const loadOdor = async () => {
    const ds = dataSourcesRef.current
    if (!ds) return
    try {
      const res = await apiClient.get<ApiResponse<OdorResponse>>('/odor/measurements')
      if (dataSourcesRef.current !== ds) return // 응답 대기 중 재마운트 시 중단
      ds.odor.entities.removeAll()
      for (const spot of res.data.data.spots) {
        addOdorSpot(ds.odor, spot, res.data.data.mock)
      }
    } catch {
      ds.odor.entities.removeAll()
    }
  }

  /** 실시간 CCTV 목록 로드 → 카메라 마커 (실패해도 다른 레이어 무영향) */
  const loadCctv = async () => {
    const ds = dataSourcesRef.current
    if (!ds) return
    try {
      const res = await apiClient.get<ApiResponse<CctvStreamsResponse>>('/cctv/streams')
      if (dataSourcesRef.current !== ds) return // 응답 대기 중 재마운트 시 중단
      ds.cctv.entities.removeAll()
      for (const cam of res.data.data.cameras) {
        addCctvCamera(ds.cctv, cam, res.data.data.mock)
      }
    } catch {
      ds.cctv.entities.removeAll()
    }
  }

  /** CCTV 프레임 추정 성공 → 해당 마커에 추정 배지(라벨 줄 추가 + 등급색) 표시. 세션 내에서만 유지 */
  const handleCctvEstimated = (camera: CctvCamera, est: CctvEstimate) => {
    const ds = dataSourcesRef.current
    if (!ds || est.pm25 == null) return
    const grade = gradeOf(est.pm25)
    const badge = estimateBadgeText(est.pm25, est.grade ?? grade.name)
    if (!badge) return
    const now = Cesium.JulianDate.now()
    for (const entity of ds.cctv.entities.values) {
      const cam = entity.properties?.cctvCamera?.getValue(now) as CctvCamera | undefined
      if (!cam || cam.name !== camera.name) continue
      if (entity.label) {
        entity.label.text = new Cesium.ConstantProperty(
          `${camera.name.replace(/^\[Mock\] /, '')}\n${badge}`)
      }
    }
  }

  /** 바람장 + 이류 예측 로드 (인천권 고정, 실패해도 다른 레이어 무영향) */
  const loadWind = async () => {
    try {
      const res = await apiClient.get<ApiResponse<WindFieldResponse>>('/wind/field')
      setWindField(res.data.data.hours.length > 0 ? res.data.data : null)
    } catch {
      setWindField(null)
    }
    try {
      const res = await apiClient.get<ApiResponse<AdvectionResponse>>('/wind/advection?hours=6')
      setAdvection(res.data.data)
    } catch {
      setAdvection(null)
    }
  }

  /** 공공 실측 IDW 격자 표면 로드 (실패해도 다른 레이어 무영향) */
  const loadIdwSurface = async (sido?: string) => {
    const ds = dataSourcesRef.current
    if (!ds) return
    try {
      const q = sido ? `?sido=${encodeURIComponent(sido)}` : ''
      const res = await apiClient.get<ApiResponse<IdwGridResponse>>(
        `/air-quality/interpolation/grid${q}`)
      if (dataSourcesRef.current !== ds) return // 응답 대기 중 재마운트 시 중단
      ds.idwSurface.entities.removeAll()
      addIdwSurface(ds.idwSurface, res.data.data)
    } catch {
      ds.idwSurface.entities.removeAll()
    }
  }

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
      // 응답 대기 중 언마운트·재마운트(StrictMode 이중 마운트 포함)로 viewer가 교체됐으면
      // 파괴된 viewer를 건드리지 않고 중단한다 (구 viewer 접근 시 TypeError 발생).
      if (viewerRef.current !== viewer || dataSourcesRef.current !== ds) return
      // 자체 레이어(관측·예측·보간)만 초기화한다. airkorea는 mode 변경 시 현재값 effect가,
      // idwSurface는 sido effect가 각각 관리하므로 여기서 지우지 않는다.
      ds.observation.entities.removeAll()
      ds.prediction.entities.removeAll()
      ds.interpolation.entities.removeAll()

      for (const o of obsRes.data.data) {
        addMarker(ds.observation, o.longitude, o.latitude, o.siteName,
          buildDescription('관측값', o.pm25, o.observedAt, o.latitude, o.longitude))
        addStaticGrid(ds.observation, o.longitude, o.latitude, o.pm25, o.siteName, '관측값',
          gridCfg)
      }
      for (const p of predRes.data.data) {
        addMarker(ds.prediction, p.longitude, p.latitude, `${p.siteName} (예측)`,
          buildDescription('AI 예측값', p.pm25, p.predictedAt, p.latitude, p.longitude),
          undefined, MAP_CONFIG.markerEmojis.prediction)
        addStaticGrid(ds.prediction, p.longitude, p.latitude, p.pm25, p.siteName, 'AI 예측값',
          gridCfg)
      }
      const seen = new Set<string>()
      for (const r of idwRes.data.data.content) {
        const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
        if (seen.has(key)) continue
        seen.add(key)
        const name = r.targetName ?? `보간지점 ${r.id}`
        addMarker(ds.interpolation, r.longitude, r.latitude, name,
          buildDescription('IDW 보간값', r.pm25, r.interpolatedAt, r.latitude, r.longitude),
          undefined, MAP_CONFIG.markerEmojis.interpolation)
        ds.interpolation.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            r.longitude, r.latitude, gridCfg.baseAltitude),
          box: {
            dimensions: new Cesium.Cartesian3(
              gridCfg.boxSize, gridCfg.boxSize, gridCfg.boxHeight),
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
      console.error('[MapPage] loadCurrent 실패:', err)
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
      const window = `from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      const sido = selectedSido || publicAir?.sido

      // 자체 관측 시계열과 공공 측정소 시계열을 함께 로드 (한쪽이 비어도 다른 쪽은 재생)
      const [obs, pub] = await Promise.all([
        apiClient
          .get<ApiResponse<SeriesSite[]>>(`/viz/observations/series?${window}`)
          .then((r) => r.data.data)
          .catch(() => [] as SeriesSite[]),
        sido
          ? apiClient
              .get<ApiResponse<PublicSeriesStation[]>>(
                `/public-data/history/measurements/series?sido=${encodeURIComponent(sido)}&${window}`)
              .then((r) => r.data.data)
              .catch(() => [] as PublicSeriesStation[])
          : Promise.resolve([] as PublicSeriesStation[]),
      ])
      // 응답 대기 중 viewer가 교체·파괴됐으면 중단 (loadCurrent와 동일한 가드)
      if (viewerRef.current !== viewer || dataSourcesRef.current !== ds) return

      if (obs.length === 0 && pub.length === 0) {
        setError('선택한 기간에 재생할 관측/공공 실측 데이터가 없습니다')
        return
      }

      // 자체 관측 → observation 레이어, 공공 실측 → airkorea 레이어 (예측/보간은 최신값 유지)
      ds.observation.entities.removeAll()
      for (const site of obs) {
        addTimeSeriesSite(ds.observation, site, gridCfg)
      }
      ds.airkorea.entities.removeAll()
      for (const station of pub) {
        addPublicTimeSeries(ds.airkorea, station)
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
      setSeriesKey((k) => k + 1) // 듀얼맵 비교 뷰가 새 기간 이력을 다시 그리도록 신호
      setLayers((prev) => ({
        ...prev,
        observation: obs.length > 0 ? true : prev.observation,
        airkorea: pub.length > 0 ? true : prev.airkorea,
      }))
      if (pub.length === 0 && sido) {
        setPublicError(`${sido} 시도의 누적 공공 실측이 아직 없어 자체 관측만 재생합니다`)
      }
    } catch (err) {
      console.error('[MapPage] loadSeries 실패:', err)
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
                // OSM 타일은 z19까지만 제공 — 그 이상 확대 시 없는 타일을 요청해
                // CORS 오류가 콘솔에 쌓이는 것을 방지 (z19 타일을 확대 표시)
                maximumLevel: 19,
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
      // 미지정 시 document.body(페이지 전체)가 전체화면 대상이 되어
      // 지도 크기가 변하지 않는 것처럼 보임 → 지도 컨테이너를 대상으로 지정
      fullscreenElement: containerRef.current,
      // 화면 캡처(canvas.toDataURL)를 위해 렌더 버퍼 유지
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    })
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.clock.shouldAnimate = false
    viewerRef.current = viewer

    const dataSources: Record<LayerKey, Cesium.CustomDataSource> = {
      observation: new Cesium.CustomDataSource('observation'),
      prediction: new Cesium.CustomDataSource('prediction'),
      interpolation: new Cesium.CustomDataSource('interpolation'),
      airkorea: new Cesium.CustomDataSource('airkorea'),
      idwSurface: new Cesium.CustomDataSource('idwSurface'),
      alertRegion: new Cesium.CustomDataSource('alertRegion'),
      odor: new Cesium.CustomDataSource('odor'),
      // wind 데이터소스에는 방향 화살표 엔티티를 넣는다
      // (파티클 애니메이션은 WindLayer가 직접 그린다).
      wind: new Cesium.CustomDataSource('wind'),
      advection: new Cesium.CustomDataSource('advection'),
      cctv: new Cesium.CustomDataSource('cctv'),
    }
    Object.values(dataSources).forEach((d) => viewer.dataSources.add(d))
    dataSourcesRef.current = dataSources

    // 거리 측정 결과 전용 데이터소스 (레이어 토글과 무관)
    const measureDs = new Cesium.CustomDataSource('measure')
    viewer.dataSources.add(measureDs)
    measureDsRef.current = measureDs

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
    // CCTV 마커 클릭 → InfoBox 대신 영상 재생 모달을 연다
    viewer.selectedEntityChanged.addEventListener((entity?: Cesium.Entity) => {
      const time = Cesium.JulianDate.now()
      const cam = entity?.properties?.cctvCamera?.getValue(time) as CctvCamera | undefined
      if (!cam) return
      const mock = entity?.properties?.cctvMock?.getValue(time) === true
      viewer.selectedEntity = undefined
      setCctvPlayback({ camera: cam, mock })
    })

    loadCurrent()
    loadPublicAir()
    loadAlerts()
    loadOdor()
    loadCctv()
    loadWind()

    return () => {
      windLayerRef.current = null // viewer.destroy()가 프리미티브를 함께 정리한다
      viewer.destroy()
      viewerRef.current = null
      dataSourcesRef.current = null
      measureDsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 최초 로드 시 핵심 CCTV 촬영 지점(연수송도)을 기본 선택하고 그 위치로 이동
  useEffect(() => {
    if (sites.length === 0 || selectedSiteId) return
    const songdo = sites.find((s) => s.name.includes('송도'))
    if (!songdo) return
    setSelectedSiteId(String(songdo.id))
    flyToSite(songdo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites])

  // 레이어 표시/숨김
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds) return
    ;(Object.keys(layers) as LayerKey[]).forEach((key) => {
      ds[key].show = layers[key]
    })
    if (windLayerRef.current) windLayerRef.current.show = layers.wind
  }, [layers])

  // 바람길 파티클 + 방향 화살표: 데이터 로드 시 생성, 시간 변경 시 데이터 교체
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !windField) return
    const hourIndex = Math.min(hourOffset, windField.hours.length - 1)
    const data = toWindData(windField, hourIndex)
    if (!windLayerRef.current) {
      // as const로 readonly가 된 colors를 mutable 배열로 복사해 전달
      const layer = new WindLayer(viewer, data,
        { ...MAP_CONFIG.windLayer, colors: [...MAP_CONFIG.windLayer.colors] })
      layer.show = layers.wind
      windLayerRef.current = layer
    } else {
      windLayerRef.current.updateWindData(data)
    }
    const ds = dataSourcesRef.current
    if (ds) addWindArrows(ds.wind, windField, hourIndex)
    // layers.wind는 위의 표시/숨김 effect가 관리 — 여기 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windField, hourOffset])

  // 이류 예측 표면: 데이터 로드·시간 변경 시 해당 프레임 재렌더
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds) return
    if (!advection) {
      ds.advection.entities.removeAll()
      return
    }
    addAdvectionFrame(ds.advection, advection, hourOffset)
  }, [advection, hourOffset])

  useEffect(() => {
    sitesRef.current = sites
  }, [sites])

  // 듀얼맵(최종보고서 그림 3-73): 우측에 예측/보간 전용 비교 뷰어를 띄우고
  // 좌측(관측) 카메라·시계에 동기화한다. 우측 뷰어의 직접 조작은 막는다(항상 좌측 추종).
  // 현재값 모드는 최신 예측/보간을, 시계열 모드는 기간 내 예측/보간 이력을 재생한다.
  useEffect(() => {
    if (!dualMode) return
    const main = viewerRef.current
    const container = compareContainerRef.current
    if (!main || !container) return

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
    const compare = new Cesium.Viewer(container, {
      baseLayer: ionToken
        ? undefined
        : Cesium.ImageryLayer.fromProviderAsync(
            Promise.resolve(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://tile.openstreetmap.org/',
                maximumLevel: 19,
              }))),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
    })
    compare.scene.globe.depthTestAgainstTerrain = false
    compare.scene.screenSpaceCameraController.enableInputs = false
    const compareDs = new Cesium.CustomDataSource('compare')
    compare.dataSources.add(compareDs)

    // 좌 → 우 카메라 동기화
    const sync = () => {
      if (compare.isDestroyed() || main.isDestroyed()) return
      compare.camera.setView({
        destination: main.camera.position,
        orientation: {
          heading: main.camera.heading,
          pitch: main.camera.pitch,
          roll: main.camera.roll,
        },
      })
    }
    const prevPercentageChanged = main.camera.percentageChanged
    main.camera.percentageChanged = 0.001
    main.camera.changed.addEventListener(sync)
    // 뷰어 리사이즈(화면 분할)가 반영된 뒤 첫 동기화
    requestAnimationFrame(sync)

    // 좌 → 우 시계 동기화 (시계열 재생 시 우측의 시간 동적 엔티티가 같은 시각을 표시)
    const clockSync = () => {
      if (compare.isDestroyed() || main.isDestroyed()) return
      compare.clock.currentTime = main.clock.currentTime
    }
    main.clock.onTick.addEventListener(clockSync)

    // 비교 데이터 로드: 현재값 모드 = 최신 예측/보간, 시계열 모드 = 기간 내 이력 재생
    let cancelled = false
    ;(async () => {
      try {
        if (mode === 'series' && from && to) {
          const fromIso = new Date(from).toISOString()
          const toIso = new Date(to).toISOString()
          const [predRes, idwRes] = await Promise.all([
            apiClient.get<ApiResponse<PageResponse<Prediction>>>('/predictions?size=200'),
            apiClient.get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=200'),
          ])
          if (cancelled || compare.isDestroyed()) return
          for (const s of predictionSeries(
              predRes.data.data.content, sitesRef.current, fromIso, toIso)) {
            addTimeSeriesSite(compareDs, s, gridCfg,
              'AI 예측 시계열', MAP_CONFIG.markerEmojis.prediction)
          }
          for (const s of interpolationSeries(idwRes.data.data.content, fromIso, toIso)) {
            addTimeSeriesSite(compareDs, s, gridCfg,
              'IDW 보간 시계열', MAP_CONFIG.markerEmojis.interpolation)
          }
        } else {
          const [predRes, idwRes] = await Promise.all([
            apiClient.get<ApiResponse<VizPoint[]>>('/viz/predictions/latest'),
            apiClient.get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=100'),
          ])
          if (cancelled || compare.isDestroyed()) return
          for (const p of predRes.data.data) {
            addMarker(compareDs, p.longitude, p.latitude, `${p.siteName} (예측)`,
              buildDescription('AI 예측값', p.pm25, p.predictedAt, p.latitude, p.longitude),
              undefined, MAP_CONFIG.markerEmojis.prediction)
            addStaticGrid(compareDs, p.longitude, p.latitude, p.pm25, p.siteName, 'AI 예측값',
              gridCfg)
          }
          const seen = new Set<string>()
          for (const r of idwRes.data.data.content) {
            const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
            if (seen.has(key)) continue
            seen.add(key)
            const name = r.targetName ?? `보간지점 ${r.id}`
            addMarker(compareDs, r.longitude, r.latitude, name,
              buildDescription('IDW 보간값', r.pm25, r.interpolatedAt, r.latitude, r.longitude),
              undefined, MAP_CONFIG.markerEmojis.interpolation)
            addStaticGrid(compareDs, r.longitude, r.latitude, r.pm25, name, 'IDW 보간값',
              gridCfg)
          }
        }
      } catch (err) {
        console.error('[MapPage] 듀얼맵 비교 데이터 로드 실패:', err)
      }
    })()

    return () => {
      cancelled = true
      if (!main.isDestroyed()) {
        main.camera.changed.removeEventListener(sync)
        main.camera.percentageChanged = prevPercentageChanged
        main.clock.onTick.removeEventListener(clockSync)
      }
      if (!compare.isDestroyed()) compare.destroy()
    }
    // seriesKey: [시계열 로드]로 기간이 바뀔 때 비교 뷰를 다시 그리기 위한 의존성
    // gridPreset: 격자 세밀도 변경 시 비교 뷰 격자도 다시 그린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dualMode, mode, seriesKey, gridPreset])

  // 공공 대기질 현재값 레이어 렌더링. 시계열 모드에서는 재생 엔티티를 유지하고,
  // 현재값 모드로 돌아오면(mode 변경) 현재 측정소·풍향을 다시 그린다.
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds || mode !== 'current') return
    if (!publicAir) {
      ds.airkorea.entities.removeAll()
      return
    }
    renderAirkoreaCurrentLayer(ds.airkorea, publicAir, pollutant, weather)
  }, [publicAir, pollutant, weather, mode])

  // 실측 IDW 격자 표면: 시도 변경 시에만 재요청 (오염물질·기상 변경과 무관)
  useEffect(() => {
    if (publicAir?.sido) loadIdwSurface(publicAir.sido)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicAir?.sido])

  // 격자 세밀도 변경 시 현재 모드의 격자를 다시 그린다 (최초 마운트 로드와 중복 방지 위해 뷰어 준비 후에만)
  const gridPresetInitRef = useRef(true)
  useEffect(() => {
    if (gridPresetInitRef.current) {
      gridPresetInitRef.current = false
      return
    }
    if (!viewerRef.current) return
    if (mode === 'series') loadSeries()
    else loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridPreset])

  // 측정 모드 (보고서 §4.3.3(3): 면적·거리·고도).
  // 거리: 좌클릭 지점 추가(점+선+누적 km), 우클릭 종료.
  // 면적: 좌클릭 꼭짓점 추가(3점부터 다각형+㎢ 라벨 갱신), 우클릭 종료.
  // 고도: 1회 클릭 지점의 지형·객체 높이 표시 후 자동 종료 (보고서: 고도는 한 번만 사용).
  // 측정 중에는 뷰어 기본 클릭 동작(엔티티 선택→InfoBox, 더블클릭 추적)을 제거해
  // 마커·격자 위를 클릭해도 InfoBox가 열리지 않게 하고, 종료 시 원래대로 복원한다.
  useEffect(() => {
    const viewer = viewerRef.current
    const measureDs = measureDsRef.current
    if (!measureTool || !viewer || !measureDs) return

    viewer.selectedEntity = undefined // 열려 있는 InfoBox 닫기
    const defaultHandler = viewer.screenSpaceEventHandler
    const defaultLeftClick = defaultHandler.getInputAction(
      Cesium.ScreenSpaceEventType.LEFT_CLICK)
    const defaultDoubleClick = defaultHandler.getInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    defaultHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    defaultHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    // 고도 측정: 반투명 격자·막대도 pickPosition으로 깊이를 얻도록 임시 활성화
    const prevPickTranslucent = viewer.scene.pickTranslucentDepth
    if (measureTool === 'height') viewer.scene.pickTranslucentDepth = true

    const labelStyle = {
      font: '13px sans-serif',
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    }
    const addVertexPoint = (lng: number, lat: number) =>
      measureDs.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 5),
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })

    // 면적 측정: 다각형·라벨 엔티티는 1개를 유지하며 꼭짓점 추가 시 갱신
    let areaPolygon: Cesium.Entity | null = null
    let areaLabel: Cesium.Entity | null = null

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const cartesian = viewer.camera.pickEllipsoid(
        click.position, viewer.scene.globe.ellipsoid)
      if (!cartesian) return
      const carto = Cesium.Cartographic.fromCartesian(cartesian)
      const point = {
        latitude: Cesium.Math.toDegrees(carto.latitude),
        longitude: Cesium.Math.toDegrees(carto.longitude),
      }

      if (measureTool === 'height') {
        // 지형 높이(지형 데이터 없는 타원체 지도는 0m) + 클릭 지점 객체(격자·막대) 높이
        const terrainH = viewer.scene.globe.getHeight(carto) ?? 0
        let objectH = 0
        if (viewer.scene.pickPositionSupported) {
          const picked = viewer.scene.pickPosition(click.position)
          if (picked) {
            const pickedCarto = Cesium.Cartographic.fromCartesian(picked)
            objectH = Math.max(0, pickedCarto.height - terrainH)
          }
        }
        addVertexPoint(point.longitude, point.latitude)
        measureDs.entities.add({
          position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 5),
          label: {
            ...labelStyle,
            text: `고도 ${Math.round(terrainH + objectH)} m`
              + ` (지형 ${Math.round(terrainH)} m + 객체 ${Math.round(objectH)} m)`,
          },
        })
        setMeasureTool(null) // 고도 측정은 1회 사용 후 종료
        return
      }

      const points = measurePointsRef.current
      points.push(point)
      addVertexPoint(point.longitude, point.latitude)

      if (measureTool === 'distance' && points.length >= 2) {
        const prev = points[points.length - 2]
        measureDs.entities.add({
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              prev.longitude, prev.latitude, point.longitude, point.latitude]),
            width: 3,
            material: Cesium.Color.YELLOW,
            clampToGround: true,
          },
        })
        measureDs.entities.add({
          position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 5),
          label: { ...labelStyle, text: `${pathDistanceKm(points).toFixed(2)} km` },
        })
      }

      if (measureTool === 'area' && points.length >= 3) {
        const positions = Cesium.Cartesian3.fromDegreesArray(
          points.flatMap((p) => [p.longitude, p.latitude]))
        if (areaPolygon) measureDs.entities.remove(areaPolygon)
        if (areaLabel) measureDs.entities.remove(areaLabel)
        areaPolygon = measureDs.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.YELLOW.withAlpha(0.25),
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
          },
        })
        const areaKm2 = polygonAreaKm2(points)
        const centerLat = points.reduce((s, p) => s + p.latitude, 0) / points.length
        const centerLng = points.reduce((s, p) => s + p.longitude, 0) / points.length
        areaLabel = measureDs.entities.add({
          position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, 5),
          label: {
            ...labelStyle,
            text: areaKm2 < 0.1
              ? `${Math.round(areaKm2 * 1_000_000).toLocaleString()} ㎡`
              : `${areaKm2.toFixed(2)} ㎢`,
          },
        })
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(() => setMeasureTool(null),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    return () => {
      handler.destroy()
      measurePointsRef.current = []
      // 뷰어 기본 클릭 동작 복원 (뷰어가 이미 파괴됐으면 생략)
      if (!viewer.isDestroyed()) {
        viewer.scene.pickTranslucentDepth = prevPickTranslucent
        if (defaultLeftClick) {
          defaultHandler.setInputAction(
            defaultLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        }
        if (defaultDoubleClick) {
          defaultHandler.setInputAction(
            defaultDoubleClick, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
        }
      }
    }
  }, [measureTool])

  /** 현재 지도 화면을 PNG로 저장 (보고서 '이미지 저장' 기능: capture_날짜.png) */
  const captureScreen = () => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.render()
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    const link = document.createElement('a')
    link.download = `capture_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`
    link.href = viewer.scene.canvas.toDataURL('image/png')
    link.click()
  }

  /** 배경지도 전환 (위성은 Cesium ion 토큰 필요) */
  const switchBaseMap = async (kind: 'osm' | 'satellite') => {
    const viewer = viewerRef.current
    if (!viewer || kind === baseMap) return
    setBaseMap(kind)
    viewer.imageryLayers.removeAll()
    if (kind === 'satellite') {
      viewer.imageryLayers.addImageryProvider(await Cesium.createWorldImageryAsync())
    } else {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/',
          maximumLevel: 19,
        }))
    }
  }

  const flyToSite = (site: Site) => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(site.longitude, site.latitude - 0.04, 6000),
      orientation: { pitch: Cesium.Math.toRadians(-35) },
      duration: 1.8,
    })
  }

  /** 시도 선택 → 공공 대기질 재조회(IDW·측정소 갱신) + 해당 시도로 카메라 이동 */
  const changeSido = (sido: string) => {
    if (!sido || sido === selectedSido) return
    setSelectedSido(sido)
    loadPublicAir(sido)
    // 인천은 핵심 대상지(미추홀·남동·연수) 조망으로, 그 외 시도는 광역 조망으로 이동
    const view = sido === '인천'
      ? INCHEON_FOCUS_VIEW
      : (() => {
          const center = SIDO_CENTERS.find((c) => c.name === sido)
          return center
            ? { longitude: center.longitude, latitude: center.latitude, height: SIDO_VIEW_HEIGHT }
            : null
        })()
    if (view) {
      viewerRef.current?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(view.longitude, view.latitude, view.height),
        duration: 1.8,
      })
    }
  }

  /** 핵심 대상지(인천 3구)로 카메라 이동 */
  const flyToDistrict = (district: { latitude: number; longitude: number }) => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        district.longitude, district.latitude, DISTRICT_VIEW_HEIGHT),
      duration: 1.8,
    })
  }

  const activeLayerCount = Object.values(layers).filter(Boolean).length
  const windHourIndex = windField ? Math.min(hourOffset, windField.hours.length - 1) : 0

  return (
    <div className="relative h-[calc(100vh-5.5rem)] min-h-[560px] w-full overflow-hidden rounded-card border border-line bg-surface">
      {/* 지도 — 화면을 가득 채우고 컨트롤은 그 위에 띄운다 */}
      <div className="flex h-full w-full">
        <div className="relative min-w-0 flex-1">
          {dualMode && <PaneLabel>관측·공공 (기준)</PaneLabel>}
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {dualMode && (
          <div className="relative min-w-0 flex-1 border-l border-line">
            <PaneLabel>
              AI 예측·보간 ({mode === 'series' ? '이력 재생' : '최신값'} · 좌측 화면 따라감)
            </PaneLabel>
            <div ref={compareContainerRef} className="h-full w-full" />
          </div>
        )}
      </div>

      <MapPanel>
        <PanelSection
          title="지역"
          icon={MapPinned}
          summary={selectedSido || undefined}
          defaultOpen
        >
          <PanelField label="시도">
            <select
              value={selectedSido}
              onChange={(e) => changeSido(e.target.value)}
              className={`${selectClass} w-full py-1.5`}
            >
              {!selectedSido && (
                <option value="" disabled>
                  불러오는 중...
                </option>
              )}
              {SIDO_CENTERS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </PanelField>

          {(!selectedSido || selectedSido === '인천') && (
            <PanelField label="핵심 대상지로 이동">
              <div className="flex gap-1.5">
                {INCHEON_CORE_DISTRICTS.map((d) => (
                  <Button
                    key={d.name}
                    size="sm"
                    className="flex-1"
                    onClick={() => flyToDistrict(d)}
                  >
                    {d.name}
                  </Button>
                ))}
              </div>
            </PanelField>
          )}

          <PanelField label="관측소로 이동">
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value)
                const site = sites.find((s) => s.id === Number(e.target.value))
                if (site) flyToSite(site)
              }}
              className={`${selectClass} w-full py-1.5`}
            >
              <option value="" disabled>
                관측소 선택...
              </option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PanelField>
        </PanelSection>

        <PanelSection
          title="레이어"
          icon={Layers}
          summary={`${activeLayerCount}개 켜짐`}
          defaultOpen
        >
          {LAYER_GROUPS.map((group) => (
            <PanelGroup key={group.label} label={group.label}>
              {group.keys.map((key) => (
                <Toggle
                  key={key}
                  checked={layers[key]}
                  onChange={(next) => setLayers({ ...layers, [key]: next })}
                  label={`${MAP_CONFIG.markerEmojis[key]} ${LAYER_LABELS[key]}`}
                />
              ))}
            </PanelGroup>
          ))}

          {layers.airkorea && (
            <PanelField label="공공 기준항목">
              <select
                value={pollutant}
                onChange={(e) => setPollutant(e.target.value as PublicPollutantKey)}
                className={`${selectClass} w-full py-1.5`}
              >
                {PUBLIC_POLLUTANTS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </PanelField>
          )}

          <PanelField label="입체격자 세밀도">
            <select
              value={gridPreset}
              onChange={(e) => setGridPreset(e.target.value as GridPresetKey)}
              className={`${selectClass} w-full py-1.5`}
            >
              {Object.entries(MAP_CONFIG.gridPresets).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </PanelField>
        </PanelSection>

        <PanelSection
          title="시간"
          icon={Clock}
          summary={mode === 'series' ? '재생 중' : '현재값'}
        >
          <PanelField label="시작">
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${selectClass} w-full py-1.5`}
            />
          </PanelField>
          <PanelField label="종료">
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${selectClass} w-full py-1.5`}
            />
          </PanelField>
          <div className="flex gap-1.5 px-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={loadSeries}
              disabled={loading || !from || !to}
            >
              시계열 재생
            </Button>
            {mode === 'series' && (
              <Button size="sm" className="flex-1" onClick={loadCurrent} disabled={loading}>
                현재값 보기
              </Button>
            )}
          </div>
          <p className="px-2 text-[0.6875rem] leading-relaxed text-ink-faint">
            {mode === 'series'
              ? '자체 관측과 공공 실측을 함께 재생합니다. 좌측 하단 위젯으로 재생·배속을, 하단 타임라인으로 시각을 조절하세요.'
              : '기간을 고르고 [시계열 재생]을 누르면 해당 기간을 시간 순서대로 재생합니다.'}
          </p>

          {windField && (layers.wind || layers.advection) && (
            <div className="mt-1 rounded-control bg-surface-muted p-2.5">
              <p className="mb-1.5 text-[0.6875rem] font-semibold text-ink-muted">
                바람·이동 예측 시각
              </p>
              <input
                type="range"
                min={0}
                max={windField.hours.length - 1}
                value={windHourIndex}
                onChange={(e) => setHourOffset(Number(e.target.value))}
                className="w-full accent-[var(--av-brand)]"
              />
              <p className="num mt-1 text-xs text-ink">
                +{windHourIndex + 1}시간 ·{' '}
                {new Date(windField.hours[windHourIndex].time).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                예보
              </p>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-faint">
                기상청 초단기예보 기반 · 중부권 격자 {windField.width}×{windField.height}
                {layers.advection && advection && ' · 바람에 의한 이동만 반영한 단순 추정'}
                {windField.mock && ' · Mock 바람 데이터(균일 바람장)'}
              </p>
            </div>
          )}
        </PanelSection>

        <PanelSection
          title="도구"
          icon={Ruler}
          summary={measureTool ? '측정 중' : undefined}
        >
          <PanelField label="측정">
            <div className="flex gap-1.5">
              {MEASURE_TOOLS.map((t) => (
                <Button
                  key={t.key}
                  size="sm"
                  className="flex-1"
                  variant={measureTool === t.key ? 'primary' : 'secondary'}
                  onClick={() => setMeasureTool(measureTool === t.key ? null : t.key)}
                  title={t.title}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </PanelField>
          <div className="flex flex-wrap gap-1.5 px-2">
            <Button size="sm" onClick={() => measureDsRef.current?.entities.removeAll()}>
              측정 지우기
            </Button>
            <Button size="sm" onClick={captureScreen} title="현재 지도 화면을 PNG로 저장">
              화면 캡처
            </Button>
            <Button
              size="sm"
              variant={dualMode ? 'primary' : 'secondary'}
              onClick={() => setDualMode(!dualMode)}
              title="관측(좌)과 AI 예측·보간(우)을 나란히 비교"
            >
              듀얼맵
            </Button>
            {(import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) && (
              <Button
                size="sm"
                onClick={() => switchBaseMap(baseMap === 'osm' ? 'satellite' : 'osm')}
                title="배경지도 전환 (위성 ↔ 일반)"
              >
                {baseMap === 'osm' ? '위성 지도' : '일반 지도'}
              </Button>
            )}
          </div>
          {measureTool && (
            <p className="px-2 text-[0.6875rem] leading-relaxed text-ink-faint">
              {MEASURE_TOOLS.find((t) => t.key === measureTool)?.title}
            </p>
          )}
        </PanelSection>

        <PanelSection title="데이터 상태" icon={Info}>
          {publicAir ? (
            <p className="px-2 text-[0.6875rem] leading-relaxed text-ink-muted">
              공공 실측 {publicAir.sido} · 측정소 {publicAir.stations.length}곳
              {publicAir.collectedAt &&
                ` · 수집 ${new Date(publicAir.collectedAt).toLocaleString('ko-KR')}`}
              <br />
              출처: 환경부·한국환경공단 AirKorea
              {weather && (
                <>
                  <br />
                  기상(기상청): {weather.temperature != null && `${weather.temperature}℃`}
                  {weather.humidity != null && ` · 습도 ${weather.humidity}%`}
                  {weather.windSpeed != null &&
                    ` · ${weather.windDirectionText ?? ''} ${weather.windSpeed}m/s`}
                  {weather.precipitationType &&
                    weather.precipitationType !== '없음' &&
                    ` · 강수 ${weather.precipitationType}`}
                </>
              )}
            </p>
          ) : (
            <p className="px-2 text-[0.6875rem] text-ink-faint">공공 데이터를 불러오지 않았습니다.</p>
          )}
          <p className="px-2 text-[0.6875rem] leading-relaxed text-ink-faint">
            박스를 클릭하면 상세정보가 열립니다 · 격자 관측소당 {gridCfg.countX}×{gridCfg.countY}×
            {gridCfg.countZ}
            {gridPreset === 'detailed' && ' (최종보고서 규격)'}
            <br />
            공공 측정소 막대의 높이는 농도 비교용 시각 표현이며 실제 오염층 높이가 아닙니다.
          </p>
        </PanelSection>
      </MapPanel>

      <MapLegend
        items={[
          ...GRADES.map((g) => ({
            name: g.name,
            color: g.chart,
            note: g.upper != null ? `≤${g.upper}` : undefined,
          })),
          { name: '데이터 없음', color: PUBLIC_GRADE_COLORS['데이터 없음'], note: '△' },
        ]}
      />

      {/* 상태 알림 — 지도 위 중앙 상단 */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-[26rem] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col gap-2">
        {error && <MapToast tone="error">{error}</MapToast>}
        {publicError && (
          <MapToast tone="warning">
            공공 대기질을 불러오지 못했습니다: {publicError} (자체 관측 레이어는 정상 표시)
          </MapToast>
        )}
        {publicAir?.mock && (
          <MapToast tone="warning">
            공공 데이터가 Mock 상태입니다. 서비스키를 설정하면 실 데이터로 바뀝니다.
          </MapToast>
        )}
        {publicAir?.stale && (
          <MapToast tone="warning">{publicAir.message ?? '오래된 데이터를 표시 중입니다.'}</MapToast>
        )}
        {loading && <MapToast tone="info">지도 데이터를 불러오는 중...</MapToast>}
      </div>

      {cctvPlayback && (
        <CctvPlayerModal
          camera={cctvPlayback.camera}
          mock={cctvPlayback.mock}
          sites={sites}
          onEstimated={handleCctvEstimated}
          onClose={() => setCctvPlayback(null)}
        />
      )}
    </div>
  )
}

/** 듀얼맵에서 각 화면이 무엇을 보여 주는지 알려 주는 라벨 */
function PaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1 text-xs text-white">
      {children}
    </span>
  )
}

/** 지도 위 상태 알림 */
function MapToast({
  tone,
  children,
}: {
  tone: 'error' | 'warning' | 'info'
  children: React.ReactNode
}) {
  const styles = {
    error:
      'border-red-200 bg-red-50/95 text-red-800 dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-200',
    warning:
      'border-amber-200 bg-amber-50/95 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-200',
    info: 'border-line bg-overlay text-ink-muted',
  }[tone]
  return (
    <div
      className={`pointer-events-auto rounded-control border px-3.5 py-2 text-xs shadow-panel backdrop-blur ${styles}`}
    >
      {children}
    </div>
  )
}
