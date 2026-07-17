# 캡스톤 결과보고서 목차 (초안)

각 장에 참조할 저장소 산출물을 표기했다. 본문 작성 시 해당 문서를 요약·인용한다.

1. **프로젝트 개요** — 목표, 범위(MVP), 팀 구성 · _implementation-plan.md 1~3장_
2. **개발 배경 및 필요성** — 미세먼지 측정 인프라 한계, 영상 기반 추정의 의의, 원 과제와의 관계
3. **관련 기술 분석** — CNN 회귀/멀티모달, IDW 공간 보간, PostGIS, CesiumJS, JWT
4. **요구사항 분석** — 사용자 역할, 기능/비기능 요구, 구현 현황 · _requirements.md_
5. **시스템 설계** — 아키텍처, 서비스 간 통신, 설계 결정 근거 · _architecture.md_
6. **데이터 수집 및 전처리** — 합성 데이터 생성 방법(안개-PM2.5 상관), CSV 스키마, ROI·MAD 보정, 날짜 단위 분할과 누수 방지 · _ai-model-design.md 3장_
7. **AI 모델 설계 및 실험** — ResNet18 멀티모달 구조, 학습 설정, 지표 결과.
   ⚠ "파이프라인 검증(합성)"과 "실데이터 성능"을 명확히 구분해 기술 · _ai-model-design.md_
8. **공간 보간 알고리즘** — IDW 수식, 경계조건, Python 교차검증 결과표 · _idw-algorithm.md_
9. **데이터베이스 및 API 구현** — ERD, 공간 컬럼 설계, API 목록, 인증·권한 · _database-design.md, api-spec.md_
10. **3차원 시각화 구현** — Cesium 구성, 3D 격자·색상 매핑, 레이어, 시계열(Clock/Timeline) · _ui-screen-spec.md_
11. **통합 시스템 구현** — 화면 흐름, Spring↔FastAPI 연동, 실행 환경(run.ps1) · _deployment.md_
12. **테스트 및 성능평가** — 단위(39+60건)·통합(29건) 결과, 교차검증, 수동 체크리스트 · _test-plan.md_
13. **수행 결과** — 시연 시나리오와 화면 캡처 · _demo-scenario.md_
14. **한계점** — 합성 데이터 의존, 관측소 수 제한, 단일 모델, 브라우저 자동 테스트 부재
15. **향후 개선방안** — 실측 데이터 수집(에어코리아+직접 촬영), 전이학습·모델 비교, Modified IDW, CZML/듀얼맵, 운영 배포(HTTPS·정적 서빙)
16. **기대효과** — 저비용 센서 보완, 미관측 지점 추정, 교육·연구 활용

## 부록

A. 설치·실행 매뉴얼(deployment.md) · B. API 명세(api-spec.md) · C. 테스트 결과서(test-plan.md) ·
D. 개발 이력(git log, docs/progress.md) · E. 트러블슈팅 모음(progress.md 각 Phase 참고)
