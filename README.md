# 도레미 (Do-Re-Mi) 🎹

피아노를 처음 배우는 사람이 **매일 10분씩** 즐겁게 연습하게 만드는 입문용 학습 웹앱입니다.

- 기준 문서: Notion「도레미 앱 MVP 사양서」/「구현 가이드」/「화면 상세 사양」/「레슨 콘텐츠 정의서」
- **현재 버전: 1.0.0** (2026-09-09 릴리스). 사양서의 MVP 3기능 · 4화면 전부 구현
- 배포: `main` 푸시 → GitHub Actions → GitHub Pages (`/doremi-app/`)

## 알려진 제한 (1.0.0)

- **실기기 QA 미실행** — 터치→소리 100ms · iPhone 무음 스위치 · 두 손가락 동시 터치 ·
  백그라운드 복귀는 코드상 대응했지만 실기기에서 측정하지 않았습니다
- **GA4 측정 ID 미발급** — 이벤트 6종은 구현·검증됐고 `gtag` 이 있으면 전송되지만,
  측정 ID가 없어 성공 지표를 아직 집계할 수 없습니다
- **피아노 음원 미확보** — Web Audio 합성음으로 동작합니다. `public/sounds/` 에
  CC0 샘플을 넣으면 코드 변경 없이 적용됩니다
- 같은 건반을 150ms 안에 다시 누르면 플래시가 재점멸하지 않고 색이 이어집니다

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
> 해당하여 Vite + React + TS로 폴백했습니다. GA4 이벤트 · 화면 사양은 변경 없습니다.
> 저장 스키마는 `doremi.v1.practice` 에 선택 필드 `freeNotes: {date, count}` 1개만 추가했습니다
> (「10음은 그날 누적, 세션 무관」을 기존 스키마로 표현할 수 없어서 — 구현 가이드 참조).

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
  main.tsx          진입점
  App.tsx           Shell(전 화면 공통 안내) + 하단 탭 + 화면 전환
  types.ts          Note · SOLFEGE · NOTE_FREQ · Step · Lesson · Progress
  index.css         전체 스타일 (한 파일)
  screens/          Home · LessonList · LessonPlay · FreePlay
  widgets/          Keyboard
  core/             lessonEngine · progress · korean   ← 화면과 분리한 순수 로직
  services/         audio · storage · streak · analytics
  data/lessons.ts   레슨 5개 데이터 (Notion 정의서의 복사본)
```

테스트는 대상 파일과 같은 디렉터리에 `*.test.ts(x)` 로 둡니다.
`src/styles.test.ts` 는 컴포넌트가 내보내는 `data-*` 상태마다 CSS 규칙이 있는지 검사합니다 —
속성만 붙고 스타일이 없어 화면에 아무 변화가 없던 결함이 실제로 발생했기 때문입니다.

## 피아노 음원

현재 저장소에는 음원 파일이 없고, **Web Audio 합성음 폴백**(triangle 오실레이터 + 0.8초
exponential 감쇠)으로 동작합니다. 사양상 폴백은 릴리스 블로커가 아닙니다.

샘플을 넣으려면 `public/sounds/` 에 `C4.mp3` ~ `B4.mp3` 7개를 두면 됩니다 — 앱이 자동으로
샘플을 우선 사용하고, 없거나 로드에 실패한 음만 합성음으로 떨어집니다. 코드 변경은 필요 없습니다.

- **CC0 / 퍼블릭 도메인 라이선스만** 사용할 것 (예: University of Iowa MIS, freesound CC0)
- 합계 300KB 이하 · **mp3 와 ogg 를 둘 다 배포**하세요. 로더는 `canPlayType` 으로
  브라우저가 읽을 수 있는 포맷을 재생 전에 1회 결정해 음당 요청 1회로 끝냅니다
  (404 를 보고 폴백하지 않습니다 — 요청이 두 배가 되고, 한 음이 없을 때 나머지까지 버립니다)
