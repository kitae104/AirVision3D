import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { WindLayer } from 'cesium-wind-layer'
import type { WindData } from 'cesium-wind-layer'
import { useEffect, useRef, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type {
  AdvectionResponse, AirAlert, ApiResponse, CurrentAirQuality, IdwGridResponse,
  InterpolationResult, OdorResponse, OdorSpot, PageResponse, PollutantValue, Prediction,
  PublicStationAir, Site, WeatherNow, WindFieldResponse,
} from '../api/client'
import { GRADES, gradeOf } from '../config/grades'
import { odorGradeOf } from '../config/odorGrades'
import { MAP_CONFIG } from '../config/mapConfig'
import {
  DISTRICT_VIEW_HEIGHT, INCHEON_CORE_DISTRICTS, INCHEON_FOCUS_VIEW,
  SIDO_CENTERS, SIDO_VIEW_HEIGHT,
} from '../config/sido'
import { summarizeAlertsByDistrict } from '../utils/alerts'
import type { DistrictAlertSummary } from '../utils/alerts'
import { interpolationSeries, predictionSeries } from '../utils/compareSeries'
import { pathDistanceKm } from '../utils/geo'
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
  | 'odor' | 'wind' | 'advection'

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
}

/** 시계열 샘플 1건이 유효한 시간 길이 (시간 단위 관측 가정) */
const SAMPLE_DURATION_SEC = 3600

/** 공공 실측 시계열 막대 높이(m). 농도는 색으로 표현하므로 높이는 고정. */
const PUBLIC_SERIES_BAR_LENGTH_M = 2500

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
function addTimeSeriesSite(ds: Cesium.CustomDataSource, site: SeriesSite,
                           markerColor: string = MAP_CONFIG.markers.observation,
                           seriesType: string = '관측값 시계열') {
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
      color: Cesium.Color.fromCssColorString(markerColor),
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
    description: buildDescription(seriesType, null, undefined, site.latitude, site.longitude),
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
    // 색상 + 텍스트 등급을 함께 표기 (색상만으로 상태를 구분하지 않음)
    addMarker(ds, station.longitude, station.latitude, `${station.stationName} (공공 실측)`,
      MAP_CONFIG.markers.airkorea, description,
      `${station.stationName}\n${v.value}${config.unit} ${grade}`)
  } else {
    // 데이터 없음/장애 측정소: 회색 마커 + 사유 텍스트 (오류처럼 보이지 않게)
    addMarker(ds, station.longitude, station.latitude, `${station.stationName} (공공 실측)`,
      PUBLIC_GRADE_COLORS['데이터 없음'], description,
      `${station.stationName}\n△ ${VALUE_STATUS_LABELS[v.status] ?? '데이터 없음'}`)
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
          <tr><th>출처</th><td>기상청 초단기예보 바람장 (수도권 격자)</td></tr>
          </tbody></table>`,
      })
    }
  }
}

/** 이류 예측 프레임 1개를 셀 타일링으로 렌더 (addIdwSurface와 동일한 표현 방식) */
function addAdvectionFrame(ds: Cesium.CustomDataSource, resp: AdvectionResponse,
                           frameIndex: number) {
  ds.entities.removeAll()
  const frame = resp.frames[Math.min(frameIndex, resp.frames.length - 1)]
  if (!frame) return
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
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 40),
        box: {
          dimensions: new Cesium.Cartesian3(
            cellLonDeg * mPerDegLon, cellLatDeg * mPerDegLat, 60),
          material: pm25Color(pm25, 0.4),
        },
        name: 'PM2.5 이동 예측',
        description: `<table class="cesium-infoBox-defaultTable"><tbody>
          <tr><th>예측 PM2.5</th><td><b>${pm25.toFixed(1)}</b> ㎍/㎥ (${gradeOf(pm25).name})</td></tr>
          ${pm10 != null ? `<tr><th>예측 PM10</th><td><b>${pm10.toFixed(1)}</b> ㎍/㎥</td></tr>` : ''}
          <tr><th>예측 시각</th><td>${timeText}</td></tr>
          <tr><th>방식</th><td>단순 이류 추정 (바람 이동만 반영, 확산·배출 미포함)</td></tr>
          </tbody></table>`,
      })
    }
  }
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
  const color = grade
    ? Cesium.Color.fromCssColorString(grade.chart)
    : Cesium.Color.fromCssColorString('#9ca3af')
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
    point: {
      pixelSize: 12,
      color: color.withAlpha(0.9),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: `👃 ${spot.spotName} ${valueText}`,
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -14),
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
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString(MAP_CONFIG.markers.airkorea),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: labelProp,
      font: '12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -16),
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
    advection: true,
  })
  const [mode, setMode] = useState<'current' | 'series'>('current')
  const [dualMode, setDualMode] = useState(false)
  /** 시계열 재로드 시 증가 — 듀얼맵 비교 뷰가 새 기간을 다시 그리도록 하는 신호 */
  const [seriesKey, setSeriesKey] = useState(0)
  const [measuring, setMeasuring] = useState(false)
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
        addTimeSeriesSite(ds.observation, site)
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
    loadCurrent()
    loadPublicAir()
    loadAlerts()
    loadOdor()
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
            addTimeSeriesSite(compareDs, s, MAP_CONFIG.markers.prediction, 'AI 예측 시계열')
          }
          for (const s of interpolationSeries(idwRes.data.data.content, fromIso, toIso)) {
            addTimeSeriesSite(compareDs, s, MAP_CONFIG.markers.interpolation, 'IDW 보간 시계열')
          }
        } else {
          const [predRes, idwRes] = await Promise.all([
            apiClient.get<ApiResponse<VizPoint[]>>('/viz/predictions/latest'),
            apiClient.get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=100'),
          ])
          if (cancelled || compare.isDestroyed()) return
          for (const p of predRes.data.data) {
            addMarker(compareDs, p.longitude, p.latitude, `${p.siteName} (예측)`,
              MAP_CONFIG.markers.prediction,
              buildDescription('AI 예측값', p.pm25, p.predictedAt, p.latitude, p.longitude))
            addStaticGrid(compareDs, p.longitude, p.latitude, p.pm25, p.siteName, 'AI 예측값')
          }
          const seen = new Set<string>()
          for (const r of idwRes.data.data.content) {
            const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
            if (seen.has(key)) continue
            seen.add(key)
            const name = r.targetName ?? `보간지점 ${r.id}`
            addMarker(compareDs, r.longitude, r.latitude, name,
              MAP_CONFIG.markers.interpolation,
              buildDescription('IDW 보간값', r.pm25, r.interpolatedAt, r.latitude, r.longitude))
            addStaticGrid(compareDs, r.longitude, r.latitude, r.pm25, name, 'IDW 보간값')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dualMode, mode, seriesKey])

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

  // 거리 측정 모드: 좌클릭으로 지점 추가(점+선+누적 거리 라벨), 우클릭으로 종료.
  // 측정 중에는 뷰어 기본 클릭 동작(엔티티 선택→InfoBox, 더블클릭 추적)을 제거해
  // 마커·격자 위를 클릭해도 InfoBox가 열리지 않게 하고, 종료 시 원래대로 복원한다.
  useEffect(() => {
    const viewer = viewerRef.current
    const measureDs = measureDsRef.current
    if (!measuring || !viewer || !measureDs) return

    viewer.selectedEntity = undefined // 열려 있는 InfoBox 닫기
    const defaultHandler = viewer.screenSpaceEventHandler
    const defaultLeftClick = defaultHandler.getInputAction(
      Cesium.ScreenSpaceEventType.LEFT_CLICK)
    const defaultDoubleClick = defaultHandler.getInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    defaultHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
    defaultHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

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
      const points = measurePointsRef.current
      points.push(point)

      measureDs.entities.add({
        position: Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, 5),
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      })
      if (points.length >= 2) {
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
          label: {
            text: `${pathDistanceKm(points).toFixed(2)} km`,
            font: '13px sans-serif',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
        })
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction(() => setMeasuring(false),
      Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    return () => {
      handler.destroy()
      measurePointsRef.current = []
      // 뷰어 기본 클릭 동작 복원 (뷰어가 이미 파괴됐으면 생략)
      if (!viewer.isDestroyed()) {
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
  }, [measuring])

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

        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <span className="text-gray-500">시도</span>
          <select
            value={selectedSido}
            onChange={(e) => changeSido(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {!selectedSido && <option value="" disabled>불러오는 중...</option>}
            {SIDO_CENTERS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {(!selectedSido || selectedSido === '인천') && (
          <span className="flex items-center gap-1.5 text-sm text-gray-700">
            <span className="text-gray-500">핵심 대상지</span>
            {INCHEON_CORE_DISTRICTS.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => flyToDistrict(d)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
              >
                {d.name}
              </button>
            ))}
          </span>
        )}

        <button
          type="button"
          onClick={() => setDualMode(!dualMode)}
          className={`rounded-md border px-2 py-1 text-xs ${
            dualMode
              ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
          title="관측(좌)과 AI 예측·보간(우)을 나란히 비교"
        >
          듀얼맵
        </button>

        <button
          type="button"
          onClick={() => setMeasuring(!measuring)}
          className={`rounded-md border px-2 py-1 text-xs ${
            measuring
              ? 'border-yellow-500 bg-yellow-500 text-white hover:bg-yellow-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
          title="좌클릭으로 지점 추가, 우클릭으로 종료"
        >
          {measuring ? '측정 중 (우클릭 종료)' : '거리 측정'}
        </button>
        <button
          type="button"
          onClick={() => measureDsRef.current?.entities.removeAll()}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          title="측정 결과 지우기"
        >
          측정 지우기
        </button>
        <button
          type="button"
          onClick={captureScreen}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          title="현재 지도 화면을 PNG로 저장"
        >
          화면 캡처
        </button>
        {(import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) && (
          <button
            type="button"
            onClick={() => switchBaseMap(baseMap === 'osm' ? 'satellite' : 'osm')}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            title="배경지도 전환 (위성 ↔ 일반)"
          >
            {baseMap === 'osm' ? '위성 지도' : '일반 지도'}
          </button>
        )}

        {layers.airkorea && (
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <span className="text-gray-500">공공 기준항목</span>
            <select
              value={pollutant}
              onChange={(e) => setPollutant(e.target.value as PublicPollutantKey)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {PUBLIC_POLLUTANTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          {GRADES.map((g) => (
            <span key={g.name} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: g.chart }} />
              {g.name}
              {g.upper != null && ` ≤${g.upper}`}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: PUBLIC_GRADE_COLORS['데이터 없음'] }}
            />
            데이터 없음 △
          </span>
        </div>
      </div>

      {/* 공공 데이터 상태 표시 (Mock/stale/마지막 수집시각) */}
      {publicAir && (
        <p className="rounded-md bg-sky-50 px-4 py-1.5 text-xs text-sky-800">
          공공 실측 ({publicAir.sido} · 출처: 환경부·한국환경공단 AirKorea) · 측정소{' '}
          {publicAir.stations.length}곳
          {publicAir.collectedAt &&
            ` · 수집 ${new Date(publicAir.collectedAt).toLocaleString('ko-KR')}`}
          {weather && (
            <span className="ml-2 text-cyan-800">
              | 기상(기상청): {weather.temperature != null && `${weather.temperature}℃`}
              {weather.humidity != null && ` · 습도 ${weather.humidity}%`}
              {weather.windSpeed != null &&
                ` · ${weather.windDirectionText ?? ''} ${weather.windSpeed}m/s`}
              {weather.precipitationType && weather.precipitationType !== '없음' &&
                ` · 강수: ${weather.precipitationType}`}
            </span>
          )}
          {publicAir.mock && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
              Mock 데이터 (서비스키 미설정)
            </span>
          )}
          {publicAir.stale && (
            <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">
              {publicAir.message ?? '오래된 데이터 표시 중'}
            </span>
          )}
        </p>
      )}
      {publicError && (
        <p className="rounded-md bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          공공 대기질 데이터를 불러오지 못했습니다: {publicError} (자체 관측 레이어는 정상 표시)
        </p>
      )}

      {/* 바람·이동 예측 시간 컨트롤 */}
      {windField && (layers.wind || layers.advection) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="font-medium text-gray-700">바람·이동 예측</span>
          <input
            type="range"
            min={0}
            max={windField.hours.length - 1}
            value={Math.min(hourOffset, windField.hours.length - 1)}
            onChange={(e) => setHourOffset(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-gray-700">
            +{Math.min(hourOffset, windField.hours.length - 1) + 1}시간 (
            {new Date(windField.hours[
              Math.min(hourOffset, windField.hours.length - 1)].time)
              .toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 예보)
          </span>
          {layers.advection && advection && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700"
              title="바람에 의한 이동만 반영한 추정입니다. 확산·배출·침적은 포함하지 않습니다.">
              단순 이류 추정
            </span>
          )}
          {windField.mock && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              Mock 바람 데이터 (균일 바람장)
            </span>
          )}
          <span className="text-xs text-gray-400">
            기상청 초단기예보 기반 · 수도권(서울·인천·경기) 격자 {windField.width}×{windField.height}
          </span>
        </div>
      )}

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
            ? '자체 관측 + 공공 실측 함께 재생 · 좌측 하단 위젯으로 재생·배속, 하단 Timeline으로 이동'
            : '기간 선택 후 [시계열 로드] → 자체 관측·공공 실측(선택 시도) 시간 재생 모드로 전환'}
        </span>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-500">지도 데이터 불러오는 중...</p>}

      <div className="flex min-h-0 flex-1 gap-2">
        <div className="relative min-w-0 flex-1">
          {dualMode && (
            <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              관측·공공 (기준)
            </span>
          )}
          <div ref={containerRef} className="h-full w-full overflow-hidden rounded-lg border border-gray-200" />
        </div>
        {dualMode && (
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              AI 예측·보간 ({mode === 'series' ? '이력 재생' : '최신값'} · 좌측 카메라·시간 추종)
            </span>
            <div ref={compareContainerRef} className="h-full w-full overflow-hidden rounded-lg border border-gray-200" />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        박스를 클릭하면 상세정보가 표시됩니다 · 격자: 관측소당{' '}
        {MAP_CONFIG.grid.countX}x{MAP_CONFIG.grid.countY}x{MAP_CONFIG.grid.countZ} · ion 토큰
        없이 OSM 지도로 동작 (.env의 VITE_CESIUM_ION_TOKEN으로 위성영상 사용 가능)
      </p>
      <p className="text-xs text-gray-400">
        공공 측정소의 막대 높이는 오염 농도를 비교하기 위한 시각적 표현입니다. 실제 오염층의
        물리적 높이를 의미하지 않습니다.
      </p>
    </div>
  )
}
