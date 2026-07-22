import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, CsvUploadResult, Site } from '../api/client'

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-gray-700'

function Message({ text, ok }: { text: string; ok: boolean }) {
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
    >
      {text}
    </p>
  )
}

/** 관리자 데이터 등록: 관측소 + 관측값 */
export default function DataEntryPage() {
  const [sites, setSites] = useState<Site[]>([])

  const loadSites = () =>
    apiClient.get<ApiResponse<Site[]>>('/sites').then((res) => setSites(res.data.data))

  useEffect(() => {
    loadSites()
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
    } catch (err) {
      setCsvMsg({ text: errorMessage(err), ok: false })
    } finally {
      setCsvUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">데이터 등록</h2>
      <p className="text-sm text-gray-500">
        개별 등록 또는 CSV 일괄 업로드(아래)로 관측값을 등록할 수 있습니다.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submitSite} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">관측소 등록</h3>
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
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            관측소 등록
          </button>
        </form>

        <form onSubmit={submitObs} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">관측값 등록</h3>
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
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            관측값 등록
          </button>
        </form>
      </div>

      <form onSubmit={submitCsv} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">관측값 CSV 일괄 업로드</h3>
        <p className="text-sm text-gray-500">
          헤더 필수 컬럼: <code className="rounded bg-gray-100 px-1">site_id</code>,{' '}
          <code className="rounded bg-gray-100 px-1">observed_at</code> · 선택 컬럼:{' '}
          <code className="rounded bg-gray-100 px-1">pm10, pm25, temperature, humidity, wind_speed, wind_direction</code>
          <br />
          시각은 ISO-8601(예: 2026-07-22T10:00:00Z) 또는 타임존 없는 한국 시각(예: 2026-07-22 10:00)을
          지원합니다. 같은 관측소·시각의 기존 데이터는 건너뜁니다(최대 10,000행).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <button
            type="submit"
            disabled={!csvFile || csvUploading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {csvUploading ? '업로드 중…' : 'CSV 업로드'}
          </button>
        </div>
        {csvMsg && <Message {...csvMsg} />}
        {csvResult && (
          <div className="space-y-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              총 <b>{csvResult.totalRows}</b>행 · 등록 <b className="text-green-700">{csvResult.inserted}</b> ·
              중복 건너뜀 <b>{csvResult.duplicateSkipped}</b> ·
              실패 <b className={csvResult.failed > 0 ? 'text-red-700' : ''}>{csvResult.failed}</b>
            </p>
            {csvResult.errors.length > 0 && (
              <ul className="list-inside list-disc text-red-700">
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
    </div>
  )
}
