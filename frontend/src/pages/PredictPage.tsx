import { useEffect, useState } from 'react'
import { Cpu, Sparkles, Target } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, PageResponse, Prediction, Site } from '../api/client'
import { gradeStyle } from '../config/grades'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  GradeBadge,
  Notice,
  PageHero,
  SectionHeading,
  Tbody,
  Td,
  Th,
  Thead,
  TableWrap,
  Tr,
  inputClass,
  labelClass,
  useKindColor,
} from '../components/ui'

/** 관리자: AI 예측 실행 (이미지 + 환경값) */
export default function PredictPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [form, setForm] = useState({ siteId: '', temperature: '', humidity: '', windSpeed: '' })
  const [image, setImage] = useState<File | null>(null)
  const [result, setResult] = useState<Prediction | null>(null)
  const [recent, setRecent] = useState<Prediction[]>([])
  const [totalPredictions, setTotalPredictions] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const accent = useKindColor('prediction')

  const loadRecent = () =>
    apiClient
      .get<ApiResponse<PageResponse<Prediction>>>('/predictions?size=10')
      .then((res) => {
        setRecent(res.data.data.content)
        setTotalPredictions(res.data.data.totalElements)
      })

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
  // 히어로는 방금 실행한 결과가 있으면 그것을, 없으면 가장 최근 저장된 예측을 보여 준다
  const headline = result ?? recent[0] ?? null
  const headlineGrade = headline ? gradeStyle(headline.predictedGrade) : null
  const matchedCount = recent.filter((p) => p.actualPm25 != null).length

  return (
    <div className="space-y-6">
      <PageHero
        accent={accent}
        eyebrow={headline ? `AI 예측 · ${headline.siteName}` : 'AI 예측'}
        value={headline ? headline.predictedPm25 : '—'}
        unit={headline ? '㎍/㎥' : undefined}
        valueColor={headlineGrade?.chart}
        badge={headline && <GradeBadge grade={headline.predictedGrade} />}
        description={
          headline
            ? `${result ? '방금 실행한' : '가장 최근'} 예측 결과입니다. 대기 이미지와 기온·습도·풍속으로 추정했습니다.`
            : '아직 실행한 예측이 없습니다. 아래 양식으로 첫 예측을 실행해 보세요.'
        }
        facts={[
          {
            icon: <Sparkles size={15} />,
            label: '누적 예측',
            value: totalPredictions != null ? `${totalPredictions.toLocaleString()}건` : '—',
          },
          {
            icon: <Cpu size={15} />,
            label: '모델',
            value: headline ? headline.modelName : '—',
          },
          {
            icon: <Target size={15} />,
            label: '실측 대조',
            value: `최근 10건 중 ${matchedCount}건`,
          },
          {
            label: '예측 시각',
            value: headline ? new Date(headline.predictedAt).toLocaleString('ko-KR') : '—',
          },
        ]}
      />

      <SectionHeading title="예측 실행" accent={accent} hint="이미지와 환경값을 넣고 결과 확인" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="예측 입력" hint="대기 이미지와 그때의 환경값을 함께 넣습니다" />
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass}>관측소 *</label>
              <select
                required
                value={form.siteId}
                onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                className={inputClass}
              >
                <option value="">선택</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>대기 이미지 *</label>
              <input
                required
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-ink hover:file:bg-brand-soft/70"
              />
              <p className="mt-1.5 text-xs text-ink-faint">
                샘플 이미지는 data/sample/dataset/images/ 의 PNG 파일을 쓸 수 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>기온 (℃) *</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>습도 (%) *</label>
                <input
                  required
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  value={form.humidity}
                  onChange={(e) => setForm({ ...form, humidity: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>풍속 (m/s) *</label>
                <input
                  required
                  type="number"
                  step="any"
                  min={0}
                  value={form.windSpeed}
                  onChange={(e) => setForm({ ...form, windSpeed: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? '예측 중... (수 초 소요)' : '예측 실행'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="예측 결과" />
          {result ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className="num text-[3rem] font-semibold leading-none tracking-tight"
                  style={{ color: grade?.chart }}
                >
                  {result.predictedPm25}
                </span>
                <span className="text-sm text-ink-muted">㎍/㎥</span>
                <GradeBadge grade={result.predictedGrade} />
              </div>
              {grade?.advice && <p className="mt-3 text-sm text-ink-muted">{grade.advice}</p>}
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-faint">관측소</dt>
                  <dd className="text-ink">{result.siteName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-faint">실제 관측값 (최신)</dt>
                  <dd className="num text-ink">
                    {result.actualPm25 != null ? `${result.actualPm25} ㎍/㎥` : '없음'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-faint">사용 모델</dt>
                  <dd className="text-ink">{result.modelName}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState
              title="아직 예측을 실행하지 않았습니다"
              hint="왼쪽 양식을 채우고 [예측 실행]을 누르면 결과가 여기에 표시됩니다."
            />
          )}
        </Card>
      </div>

      <div>
        <SectionHeading title="최근 예측" accent={accent} hint="최신 10건" />
        <TableWrap>
          <Thead>
            <tr>
              <Th>시각</Th>
              <Th>관측소</Th>
              <Th>예측 PM2.5</Th>
              <Th>등급</Th>
              <Th>실제 관측값</Th>
              <Th>모델</Th>
            </tr>
          </Thead>
          <Tbody>
            {recent.map((p) => (
              <Tr key={p.id}>
                <Td className="num text-ink-muted">
                  {new Date(p.predictedAt).toLocaleString('ko-KR')}
                </Td>
                <Td>{p.siteName}</Td>
                <Td className="num font-medium">{p.predictedPm25}</Td>
                <Td>
                  <GradeBadge grade={p.predictedGrade} size="sm" />
                </Td>
                <Td className="num">{p.actualPm25 ?? '-'}</Td>
                <Td className="text-xs text-ink-faint">{p.modelName}</Td>
              </Tr>
            ))}
          </Tbody>
        </TableWrap>
        {recent.length === 0 && (
          <EmptyState
            title="예측 기록이 없습니다"
            hint="예측을 실행하면 최근 10건이 여기에 쌓입니다."
          />
        )}
      </div>
    </div>
  )
}
