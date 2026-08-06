import { useEffect, useState } from 'react'
import { Database, MapPin, Radio } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, CsvUploadResult, Observation, PageResponse, Site } from '../api/client'
import {
  Button,
  Card,
  CardHeader,
  Notice,
  PageHero,
  SectionHeading,
  inputClass,
  labelClass,
  useKindColor,
} from '../components/ui'

const inputCls = inputClass
const labelCls = labelClass

function Message({ text, ok }: { text: string; ok: boolean }) {
  return <Notice tone={ok ? 'success' : 'error'}>{text}</Notice>
}

/** 관리자 데이터 등록: 관측소 + 관측값 */
export default function DataEntryPage() {
  const [sites, setSites] = useState<Site[]>([])
  // 히어로에 "지금까지 얼마나 쌓였는지"를 보여 주기 위한 최소 조회 (1건만 받아 총계만 사용)
  const [totalObs, setTotalObs] = useState<number | null>(null)
  const [latestObs, setLatestObs] = useState<Observation | null>(null)
  const accent = useKindColor('observation')

  const loadSites = () =>
    apiClient.get<ApiResponse<Site[]>>('/sites').then((res) => setSites(res.data.data))

  const loadTotals = () =>
    apiClient
      .get<ApiResponse<PageResponse<Observation>>>('/observations?size=1')
      .then((res) => {
        setTotalObs(res.data.data.totalElements)
        setLatestObs(res.data.data.content[0] ?? null)
      })
      .catch(() => setTotalObs(null))

  useEffect(() => {
    loadSites()
    loadTotals()
  }, [])

  // --- 관측소 등록 ---
  const [site, setSite] = useState({ name: '', latitude: '', longitude: '', altitude: '', siteType: 'SENSOR', description: '' })
  const [siteMsg, setSiteMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const submitSite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSiteMsg(null)
    try {
      await apiClient.post('/sites', {
        name: site.name,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
        altitude: site.altitude ? Number(site.altitude) : null,
        siteType: site.siteType,
        description: site.description || null,
      })
      setSiteMsg({ text: `관측소 '${site.name}' 등록 완료`, ok: true })
      setSite({ name: '', latitude: '', longitude: '', altitude: '', siteType: 'SENSOR', description: '' })
      loadSites()
    } catch (err) {
      setSiteMsg({ text: errorMessage(err), ok: false })
    }
  }

  // --- 관측값 등록 ---
  const [obs, setObs] = useState({ siteId: '', observedAt: '', pm10: '', pm25: '', temperature: '', humidity: '', windSpeed: '', windDirection: '' })
  const [obsMsg, setObsMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const submitObs = async (e: React.FormEvent) => {
    e.preventDefault()
    setObsMsg(null)
    try {
      await apiClient.post('/observations', {
        siteId: Number(obs.siteId),
        observedAt: new Date(obs.observedAt).toISOString(),
        pm10: obs.pm10 ? Number(obs.pm10) : null,
        pm25: obs.pm25 ? Number(obs.pm25) : null,
        temperature: obs.temperature ? Number(obs.temperature) : null,
        humidity: obs.humidity ? Number(obs.humidity) : null,
        windSpeed: obs.windSpeed ? Number(obs.windSpeed) : null,
        windDirection: obs.windDirection ? Number(obs.windDirection) : null,
      })
      setObsMsg({ text: '관측값 등록 완료', ok: true })
      loadTotals()
      setObs({ ...obs, pm10: '', pm25: '', temperature: '', humidity: '', windSpeed: '', windDirection: '' })
    } catch (err) {
      setObsMsg({ text: errorMessage(err), ok: false })
    }
  }

  // --- CSV 일괄 업로드 ---
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<CsvUploadResult | null>(null)
  const [csvMsg, setCsvMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const submitCsv = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvFile) return
    setCsvMsg(null)
    setCsvResult(null)
    setCsvUploading(true)
    try {
      const body = new FormData()
      body.append('file', csvFile)
      const res = await apiClient.post<ApiResponse<CsvUploadResult>>('/observations/csv', body)
      setCsvResult(res.data.data)
      setCsvMsg({ text: 'CSV 업로드 완료', ok: true })
      loadTotals()
    } catch (err) {
      setCsvMsg({ text: errorMessage(err), ok: false })
    } finally {
      setCsvUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        accent={accent}
        eyebrow="자체 관측 · 등록 현황"
        value={totalObs != null ? totalObs.toLocaleString() : '—'}
        unit="건"
        description="지금까지 등록된 자체 관측값입니다. 아래에서 한 건씩 또는 CSV로 추가합니다."
        facts={[
          { icon: <Radio size={15} />, label: '관측소', value: `${sites.length}곳` },
          {
            icon: <MapPin size={15} />,
            label: '최근 등록 지점',
            value: latestObs ? latestObs.siteName : '—',
          },
          {
            icon: <Database size={15} />,
            label: '최근 관측 시각',
            value: latestObs ? new Date(latestObs.observedAt).toLocaleString('ko-KR') : '—',
          },
        ]}
      />

      <SectionHeading title="개별 등록" accent={accent} hint="관측소를 만들고 관측값을 한 건씩 입력" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="관측소 등록" hint="관측값을 기록할 지점을 먼저 만듭니다" />
          <form onSubmit={submitSite} className="space-y-4">
          <div>
            <label className={labelCls}>이름 *</label>
            <input required value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>위도 *</label>
              <input required type="number" step="any" min={-90} max={90} value={site.latitude} onChange={(e) => setSite({ ...site, latitude: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>경도 *</label>
              <input required type="number" step="any" min={-180} max={180} value={site.longitude} onChange={(e) => setSite({ ...site, longitude: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>고도 (m)</label>
              <input type="number" step="any" value={site.altitude} onChange={(e) => setSite({ ...site, altitude: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>유형</label>
              <select value={site.siteType} onChange={(e) => setSite({ ...site, siteType: e.target.value })} className={inputCls}>
                <option value="SENSOR">SENSOR (센서)</option>
                <option value="CCTV">CCTV (촬영 지점)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>설명</label>
            <input value={site.description} onChange={(e) => setSite({ ...site, description: e.target.value })} className={inputCls} />
          </div>
          {siteMsg && <Message {...siteMsg} />}
          <Button type="submit" variant="primary">
            관측소 등록
          </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="관측값 등록" hint="한 건씩 직접 입력합니다" />
          <form onSubmit={submitObs} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>관측소 *</label>
              <select required value={obs.siteId} onChange={(e) => setObs({ ...obs, siteId: e.target.value })} className={inputCls}>
                <option value="">선택</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>관측 시각 *</label>
              <input required type="datetime-local" value={obs.observedAt} onChange={(e) => setObs({ ...obs, observedAt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PM2.5 (㎍/㎥)</label>
              <input type="number" step="any" min={0} value={obs.pm25} onChange={(e) => setObs({ ...obs, pm25: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PM10 (㎍/㎥)</label>
              <input type="number" step="any" min={0} value={obs.pm10} onChange={(e) => setObs({ ...obs, pm10: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>기온 (℃)</label>
              <input type="number" step="any" value={obs.temperature} onChange={(e) => setObs({ ...obs, temperature: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>습도 (%)</label>
              <input type="number" step="any" min={0} max={100} value={obs.humidity} onChange={(e) => setObs({ ...obs, humidity: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>풍속 (m/s)</label>
              <input type="number" step="any" min={0} value={obs.windSpeed} onChange={(e) => setObs({ ...obs, windSpeed: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>풍향 (°)</label>
              <input type="number" step="any" min={0} max={359.9} value={obs.windDirection} onChange={(e) => setObs({ ...obs, windDirection: e.target.value })} className={inputCls} />
            </div>
          </div>
          {obsMsg && <Message {...obsMsg} />}
          <Button type="submit" variant="primary">
            관측값 등록
          </Button>
          </form>
        </Card>
      </div>

      <SectionHeading title="일괄 등록" accent={accent} hint="CSV 파일로 한 번에 올리기" />
      <Card>
        <CardHeader
          title="관측값 CSV 일괄 업로드"
          hint="한 번에 최대 10,000행까지 등록합니다"
        />
        <form onSubmit={submitCsv} className="space-y-4">
        <div className="rounded-control bg-surface-muted p-3.5 text-sm text-ink-muted">
          <p>
            필수 컬럼 <Code>site_id</Code>, <Code>observed_at</Code> · 선택 컬럼{' '}
            <Code>pm10, pm25, temperature, humidity, wind_speed, wind_direction</Code>
          </p>
          <p className="mt-1.5">
            시각은 ISO-8601(예: 2026-07-22T10:00:00Z) 또는 타임존 없는 한국 시각(예: 2026-07-22
            10:00)을 지원합니다. 같은 관측소·시각의 기존 데이터는 건너뜁니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="text-sm text-ink-muted file:mr-3 file:rounded-control file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-ink hover:file:bg-brand-soft/70"
          />
          <Button type="submit" variant="primary" disabled={!csvFile || csvUploading}>
            {csvUploading ? '업로드 중…' : 'CSV 업로드'}
          </Button>
        </div>
        {csvMsg && <Message {...csvMsg} />}
        {csvResult && (
          <div className="rounded-control border border-line bg-surface-muted p-3.5 text-sm text-ink">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <ResultStat label="총 행" value={csvResult.totalRows} />
              <ResultStat
                label="등록"
                value={csvResult.inserted}
                className="text-emerald-600 dark:text-emerald-400"
              />
              <ResultStat label="중복 건너뜀" value={csvResult.duplicateSkipped} />
              <ResultStat
                label="실패"
                value={csvResult.failed}
                className={csvResult.failed > 0 ? 'text-red-600 dark:text-red-400' : undefined}
              />
            </div>
            {csvResult.errors.length > 0 && (
              <ul className="mt-3 list-inside list-disc space-y-0.5 border-t border-line pt-3 text-xs text-red-600 dark:text-red-400">
                {csvResult.errors.map((err) => (
                  <li key={`${err.line}-${err.message}`}>
                    {err.line}행: {err.message}
                  </li>
                ))}
                {csvResult.failed > csvResult.errors.length && (
                  <li>… 외 {csvResult.failed - csvResult.errors.length}건 (상위 20건만 표시)</li>
                )}
              </ul>
            )}
          </div>
        )}
        </form>
      </Card>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-ink">{children}</code>
  )
}

function ResultStat({
  label,
  value,
  className = '',
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <span>
      <span className="text-xs text-ink-faint">{label} </span>
      <b className={`num ${className}`}>{value.toLocaleString()}</b>
    </span>
  )
}
