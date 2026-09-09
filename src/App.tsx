import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { completeLesson, nextIncompleteLesson, stepFor } from './core/progress'
import { LESSONS } from './data/lessons'
import { FreePlay } from './screens/FreePlay'
import { Home } from './screens/Home'
import { LessonList } from './screens/LessonList'
import { LessonPlay } from './screens/LessonPlay'
import { createAnalytics, type Analytics } from './services/analytics'
import { createAudioEngine, type AudioEngine } from './services/audio'
import { createStorage, type Storage } from './services/storage'
import { streak, todayStr } from './services/streak'

// 하단 탭 3개. '레슨 플레이'는 탭 없이 전체 화면으로 열리므로 여기 포함하지 않는다.
const TAB_LABELS = {
  home: '🏠 홈',
  lessons: '🎼 레슨',
  practice: '🎹 연습',
} as const

type TabId = keyof typeof TAB_LABELS

const TAB_IDS = Object.keys(TAB_LABELS) as TabId[]

/** 자유 연습에서 이만큼 치면 그날 '연습함' 으로 인정 (그날 누적, 세션 무관) */
const FREE_PLAY_NOTES_FOR_PRACTICE = 10

/**
 * 엣지 케이스 안내(저장 불가 배너 · 가로 회전 오버레이)는 사양상 "전 화면 공통" 이므로
 * 레슨 플레이 전체 화면에서도 보여야 한다. 두 분기가 이 껍데기를 공유한다.
 *
 * App 안에 정의하면 렌더마다 컴포넌트 정체성이 바뀌어 하위 트리가 언마운트되고
 * LessonPlay 의 진행 상태가 날아간다 — 반드시 모듈 레벨에 둔다.
 */
function Shell({ canSave, children }: { canSave: boolean; children: ReactNode }) {
  return (
    <div className="app">
      {/* 세로 화면 고정: 가로에서는 CSS 미디어쿼리로 이 안내만 덮어 보여준다 */}
      <div className="landscape-warn" role="alert">
        세로 화면으로 돌려주세요
      </div>

      {canSave ? null : (
        <p className="banner" role="status">
          이 브라우저에서는 진도가 저장되지 않아요
        </p>
      )}

      {children}
    </div>
  )
}

export interface AppProps {
  storage?: Storage
  analytics?: Analytics
  audio?: AudioEngine
}

export function App({ storage, analytics, audio }: AppProps = {}) {
  // 쓰기가 도중에 실패하면(용량 초과 등) 배너를 띄우기 위해 리렌더가 필요하다
  const [writeFailed, setWriteFailed] = useState(false)
  const store = useMemo(
    () => storage ?? createStorage(safeLocalStorage(), { onWriteFailure: () => setWriteFailed(true) }),
    [storage],
  )
  const track = useMemo(() => analytics ?? createAnalytics(), [analytics])
  const engine = useMemo(() => audio ?? createAudioEngine(), [audio])

  const [tab, setTab] = useState<TabId>('home')
  const [progress, setProgress] = useState(() => store.loadProgress())
  const [practiceDates, setPracticeDates] = useState(() => store.loadPractice().dates)
  const [openLessonId, setOpenLessonId] = useState<number | null>(null)
  // lesson_complete 의 duration 용 — 레슨 진입 시각
  const lessonStartedAt = useRef(0)

  const today = todayStr()
  const streakDays = streak(practiceDates, today)
  const canSave = store.available && !writeFailed

  // 사양: "앱 시작 시 샘플 7개를 미리 fetch + decodeAudioData"
  useEffect(() => {
    engine.loadSamples().catch(() => {})
  }, [engine])

  useEffect(() => {
    track.track('app_open')
  }, [track])

  /**
   * 오늘을 연습일로 기록. 새로 기록됐으면 streak_updated 를 1회 보낸다.
   * 날짜는 렌더 시점 값이 아니라 호출 시점에 다시 구한다 — 앱을 열어 둔 채
   * 자정을 넘기면 렌더가 없어 stale 한 어제 날짜로 기록될 수 있다.
   */
  const markPracticedToday = useCallback(() => {
    const now = todayStr()
    if (!store.markPracticed(now)) return
    const dates = store.loadPractice().dates
    setPracticeDates(dates)
    track.track('streak_updated', { streak_days: streak(dates, now) })
  }, [store, track])

  const currentLesson = nextIncompleteLesson(progress.completedLessons)
  const openLesson = LESSONS.find((l) => l.id === openLessonId)
  // 완료 레슨 '다시 하기'·'전체 복습하기' 는 진도를 저장하지 않는다
  const isReplay = openLesson ? progress.completedLessons.includes(openLesson.id) : false

  function saveProgress(next: typeof progress) {
    setProgress(next)
    store.saveProgress(next)
  }

  function openLessonById(lessonId: number) {
    setOpenLessonId(lessonId)
    lessonStartedAt.current = performance.now()
    track.track('lesson_start', { lesson_id: lessonId })
  }

  if (openLesson) {
    return (
      <Shell canSave={canSave}>
        <LessonPlay
          key={openLesson.id}
          lesson={openLesson}
          startStep={isReplay ? 0 : stepFor(progress, openLesson.id)}
          hasNextLesson={LESSONS.some((l) => l.id === openLesson.id + 1)}
          streakDays={streakDays}
          canSave={canSave}
          audio={engine}
          onClose={() => {
            setOpenLessonId(null)
            setTab('lessons')
          }}
          onHome={() => {
            setOpenLessonId(null)
            setTab('home')
          }}
          onStepChange={(stepIndex) => {
            if (!isReplay) saveProgress({ ...progress, currentLesson: openLesson.id, currentStep: stepIndex })
          }}
          onStepCompleted={markPracticedToday}
          onComplete={(lessonId) => {
            // 사양: lesson_complete 는 완료 화면 표시 시점에 lesson_id · duration 과 함께
            track.track('lesson_complete', {
              lesson_id: lessonId,
              duration: Math.round((performance.now() - lessonStartedAt.current) / 1000),
            })
            // completeLesson 이 복습(이미 완료한 레슨)일 때 진도를 그대로 반환한다
            const next = completeLesson(progress, lessonId)
            if (next !== progress) saveProgress(next)
          }}
          onNextLesson={() => {
            const next = LESSONS.find((l) => l.id === openLesson.id + 1)
            if (next) openLessonById(next.id)
            else setOpenLessonId(null)
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell canSave={canSave}>
      {TAB_IDS.map((id) => (
        <main
          key={id}
          className="screen"
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          // 비활성 패널은 접근성 트리에서 빼되, aria-controls가 가리킬 수 있도록 DOM에는 남긴다
          hidden={id !== tab}
        >
          {id === 'home' ? (
            <Home
              completed={progress.completedLessons}
              practiceDates={practiceDates}
              today={today}
              hasProgress={progress.currentStep > 0}
              onContinue={openLessonById}
            />
          ) : null}
          {id === 'lessons' ? (
            <LessonList
              completed={progress.completedLessons}
              currentLesson={currentLesson}
              currentStep={stepFor(progress, currentLesson)}
              onOpen={openLessonById}
            />
          ) : null}
          {id === 'practice' ? (
            <PracticeTab
              active={tab === 'practice'}
              audio={engine}
              store={store}
              track={track}
              onPracticed={markPracticedToday}
            />
          ) : null}
        </main>
      ))}

      <nav className="tabbar" role="tablist" aria-label="주요 화면">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={id === tab}
            aria-controls={`panel-${id}`}
            className={id === tab ? 'tab tab--active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </nav>
    </Shell>
  )
}

/** 연습 탭 — practice_start/complete 와 10음 판정을 담당한다 */
function PracticeTab({
  active,
  audio,
  store,
  track,
  onPracticed,
}: {
  active: boolean
  audio: AudioEngine
  store: Storage
  track: Analytics
  onPracticed: () => void
}) {
  const enteredAt = useRef(0)

  useEffect(() => {
    if (!active) return
    track.track('practice_start')
    enteredAt.current = performance.now()
    // 탭 이탈 시(언마운트 포함) 체류 시간을 보낸다.
    // 브라우저 강제 종료로 유실될 수 있으나 MVP 에서는 허용한다 (구현 가이드)
    return () => {
      const duration = Math.round((performance.now() - enteredAt.current) / 1000)
      track.track('practice_complete', { duration })
    }
  }, [active, track])

  return (
    <FreePlay
      audio={audio}
      onNotePlayed={() => {
        // 이미 오늘 연습함으로 기록됐으면 더 셀 필요가 없다 (매 터치 쓰기 방지).
        // 날짜는 호출 시점에 구한다 — 자정을 넘겨도 올바른 날짜에 쌓인다
        const now = todayStr()
        if (store.loadPractice().dates.includes(now)) return
        if (store.addFreeNotes(now, 1) >= FREE_PLAY_NOTES_FOR_PRACTICE) onPracticed()
      }}
    />
  )
}

/** 시크릿 모드에서는 localStorage 접근 자체가 던질 수 있다 */
function safeLocalStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}
