# 도레미 (Do-Re-Mi) 🎹

피아노를 처음 배우는 사람이 **매일 10분씩** 즐겁게 연습하게 만드는 입문용 학습 웹앱입니다.

- 기준 문서: Notion「도레미 앱 MVP 사양서」/「구현 가이드」/「화면 상세 사양」/「레슨 콘텐츠 정의서」
- 목표 릴리스: 2026-09-12 (MVP v0.1)
- 배포: `main` 푸시 → GitHub Actions → GitHub Pages (`/doremi-app/`)

## 기술 스택

| 항목 | 선택 |
| --- | --- |
| 프레임워크 | Vite + React + TypeScript |
| 상태 관리 | React 내장 (`useState`) — 화면 4개에 별도 라이브러리 불필요 |
| 라우터 | 없음 (탭 상태 전환) |
| 오디오 | Web Audio API 직접 호출 |
| 저장 | localStorage (백엔드 없음) |
| 테스트 | Vitest + Testing Library |

> **언어 결정:** 원래 계획은 Dart · Flutter Web이었으나, ADR-001의 폴백 조건 ②(Dart 작성 가능자 없음)에
> 해당하여 Vite + React + TS로 폴백했습니다. 저장 스키마 · GA4 이벤트 · 화면 사양은 변경 없습니다.

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm test         # 단위 테스트
npm run lint     # 린트
npm run build    # 프로덕션 빌드 (타입 체크 포함)
```

## 폴더 구조

구현 가이드의 Flutter 구조(`lib/`)를 `src/`로 그대로 대응시킵니다.

```
src/
  main.tsx          진입점                        (← lib/main.dart)
  App.tsx           하단 탭 + 화면 전환
  screens/          home · lesson_list · lesson_play · free_play   (예정)
  widgets/          keyboard · streak_card · practice_calendar     (예정)
  services/         audio · storage · streak · analytics           (예정)
  data/lessons.ts   레슨 5개 데이터                                (예정)
```

`(예정)` 표시는 아직 만들지 않은 디렉터리입니다 — 해당 기능 PR에서 추가합니다.

## 피아노 음원

현재 저장소에는 음원 파일이 없고, **Web Audio 합성음 폴백**(triangle 오실레이터 + 0.8초
exponential 감쇠)으로 동작합니다. 사양상 폴백은 릴리스 블로커가 아닙니다.

샘플을 넣으려면 `public/sounds/` 에 `C4.mp3` ~ `B4.mp3` 7개를 두면 됩니다 — 앱이 자동으로
샘플을 우선 사용하고, 없거나 로드에 실패한 음만 합성음으로 떨어집니다. 코드 변경은 필요 없습니다.

- **CC0 / 퍼블릭 도메인 라이선스만** 사용할 것 (예: University of Iowa MIS, freesound CC0)
- 합계 300KB 이하 · mp3 + ogg 권장 (현재 로더는 mp3 경로만 조회)
