# CCTV 실시간 영상 → AI 미세먼지 즉시 추정 설계 (Phase 33)

- 작성일: 2026-07-26
- 상태: 사용자 승인 완료 (모달 + 지도 배지 범위)

## 목적

Phase 32의 CCTV 재생 모달과 Phase 28의 즉시 추정 엔드포인트(`POST /api/predictions/cctv`)를
연결해, 재생 중인 CCTV 화면의 현재 프레임으로 PM2.5·등급·가시거리를 즉시 추정하고
결과를 모달과 지도 CCTV 마커 배지에 표시한다. 저장(DB)은 하지 않는다.

## 선택한 방식

**A안: 프론트 전용 — 브라우저에서 프레임 캡처.** 백엔드 변경 없음.

- 모달의 `<video>`를 캔버스에 그려 JPEG(품질 0.85)로 캡처한다.
- hls.js(MSE) 재생 경로는 미디어 데이터가 JS로 주입되므로 캔버스 오염 없이 캡처 가능.
- Safari 네이티브 HLS 경로는 보안 제한(canvas taint)으로 캡처 불가 → 안내 문구 표시.
- 실키 검증에서 ITS 스트림이 CORS로 재생 자체가 막히면 백엔드 프록시를 후속 검토(B안 예비).

기각: B안 백엔드 프레임 캡처(ffmpeg) — 의존성·서버 부하가 MVP 원칙에 어긋남.

## 동작 흐름

1. CCTV 모달에 "이 화면으로 미세먼지 추정" 버튼 추가.
   - Mock 모드(스트림 없음)에서는 "샘플 이미지로 추정 시연" — 캔버스로 합성한
     하늘 그라데이션 이미지를 사용한다(저장소에 바이너리 미추가).
2. 카메라 좌표에서 최근접 관측소(haversine)를 찾아 `siteId`로 사용.
3. 해당 관측소 최신 관측(`GET /api/observations?siteId&size=1`)의 온도·습도를 자동 입력.
   값이 없으면 기본값 20℃/50%를 쓰고 "기본값 사용"을 결과에 표시.
4. `POST /api/predictions/cctv` (multipart: siteId, image, temperature, humidity).
5. 결과 패널: PM2.5·등급(등급색 배지)·PM10·가시거리·모드·사용 관측소/온습도.
   - `mode=STATION_FALLBACK`(야간)은 "야간 — 최근접 실측 대체(측정소명)"로 표기.
6. 지도 배지: 해당 CCTV 마커 라벨에 `PM2.5 12.3 (좋음)` 줄 추가 + 마커 색을 등급색으로.
   세션 내에서만 유지(레이어 재로드 시 초기화), 저장 없음.

## 변경 파일

- `frontend/src/api/client.ts`: `CctvEstimate` 타입 추가.
- `frontend/src/utils/cctvEstimate.ts` (신규): `nearestSite`, 기본 온습도 상수,
  배지 문자열 생성 — 순수 함수로 분리해 Vitest 단위 테스트.
- `frontend/src/utils/cctvEstimate.test.ts` (신규).
- `frontend/src/pages/MapPage.tsx`: 모달 버튼·캡처·결과 패널, 마커 배지 갱신 콜백.
- 문서: `docs/progress.md`(Phase 33), `docs/user-guide.html`(§7 + 이력 v1.22).
- 백엔드: 변경 없음.

## 오류 처리

- 영상 미준비(videoWidth=0): "영상이 아직 준비되지 않았습니다".
- 캔버스 오염(Safari 네이티브 HLS): "이 브라우저에서는 보안 제한으로 화면 캡처를 지원하지 않습니다".
- AI 서비스 미기동(502) 등 서버 오류: 백엔드 메시지 그대로 표시(`errorMessage`).
- 관측소 목록 비어 있음: "추정에 사용할 관측소가 없습니다".

## 테스트 계획

- Vitest: 최근접 관측소 선택(빈 목록 포함), 배지 문자열 생성.
- `tsc --noEmit`, `vite build`.
- Mock 경로 실기동(백엔드+프론트)으로 샘플 이미지 추정 흐름 확인 — AI 서비스 기동 필요.
