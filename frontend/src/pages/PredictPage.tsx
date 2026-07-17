import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, PageResponse, Prediction, Site } from '../api/client'
import { gradeStyle } from '../config/grades'

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-gray-700'

/** 관리자: AI 예측 실행 (이미지 + 환경값) */
export default function PredictPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [form, setForm] = useState({ siteId: '', temperature: '', humidity: '', windSpeed: '' })
  const [image, setImage] = useState<File | null>(null)
  const [result, setResult] = useState<Prediction | null>(null)
  const [recent, setRecent] = useState<Prediction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadRecent = () =>
    apiClient
      .get<ApiResponse<PageResponse<Prediction>>>('/predictions?size=10')
      .then((res) => setRecent(res.data.data.content))

  useEffect(() => {
    apiClient.get<ApiResponse<Site[]>>('/sites').then((res) => setSites(res.data.data))
    loadRecent()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image) {
      setError('대기 이미지를 선택하세요')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const body = new FormData()
      body.append('siteId', form.siteId)
      body.append('image', image)
      body.append('temperature', form.temperature)
      body.append('humidity', form.humidity)
      body.append('windSpeed', form.windSpeed)
      const res = await apiClient.post<ApiResponse<Prediction>>('/predictions/run', body)
      setResult(res.data.data)
      loadRecent()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const grade = result ? gradeStyle(result.predictedGrade) : null

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">AI 예측 실행</h2>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label className={labelCls}>관측소 *</label>
            <select required value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} className={inputCls}>
              <option value="">선택</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>대기 이미지 *</label>
            <input required type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="text-sm" />
            <p className="mt-1 text-xs text-gray-400">
              샘플: data/sample/dataset/images/ 의 PNG 파일 사용 가능
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>기온 (℃) *</label>
              <input required type="number" step="any" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>습도 (%) *</label>
              <input required type="number" step="any" min={0} max={100} value={form.humidity} onChange={(e) => setForm({ ...form, humidity: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>풍속 (m/s) *</label>
              <input required type="number" step="any" min={0} value={form.windSpeed} onChange={(e) => setForm({ ...form, windSpeed: e.target.value })} className={inputCls} />
            </div>
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? '예측 중... (수 초 소요)' : '예측 실행'}
          </button>
        </form>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">예측 결과</h3>
          {result ? (
            <div className="space-y-2">
              <p className="text-4xl font-bold text-gray-900">
                {result.predictedPm25} <span className="text-lg font-normal text-gray-500">㎍/㎥</span>
              </p>
              {grade && (
                <span className={`inline-block rounded-full px-3 py-1 text-sm ${grade.badge}`}>
                  {result.predictedGrade}
                </span>
              )}
              <p className="text-sm text-gray-600">관측소: {result.siteName}</p>
              <p className="text-sm text-gray-600">
                실제 관측값(최신): {result.actualPm25 ?? '없음'} ㎍/㎥
              </p>
              <p className="text-xs text-gray-400">모델: {result.modelName}</p>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">
              왼쪽 양식으로 예측을 실행하면 결과가 표시됩니다
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">최근 예측</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">시각</th>
              <th className="px-4 py-2">관측소</th>
              <th className="px-4 py-2">예측 PM2.5</th>
              <th className="px-4 py-2">등급</th>
              <th className="px-4 py-2">실제 관측값</th>
              <th className="px-4 py-2">모델</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recent.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-gray-600">{new Date(p.predictedAt).toLocaleString('ko-KR')}</td>
                <td className="px-4 py-2">{p.siteName}</td>
                <td className="px-4 py-2 font-medium">{p.predictedPm25}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${gradeStyle(p.predictedGrade)?.badge ?? ''}`}>
                    {p.predictedGrade}
                  </span>
                </td>
                <td className="px-4 py-2">{p.actualPm25 ?? '-'}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{p.modelName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
