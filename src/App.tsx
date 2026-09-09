import { useEffect, useMemo, useState } from 'react'
import { LESSONS } from './data/lessons'
import { FreePlay } from './screens/FreePlay'
import { LessonList } from './screens/LessonList'
import { LessonPlay } from './screens/LessonPlay'
import { createAudioEngine } from './services/audio'

// 하단 탭 3개. '레슨 플레이'는 탭 없이 전체 화면으로 열리므로 여기 포함하지 않는다.
const TAB_LABELS = {
  home: '🏠 홈',
  lessons: '🎼 레슨',
  practice: '🎹 연습',
} as const

type TabId = keyof typeof TAB_LABELS

const TAB_IDS = Object.keys(TAB_LABELS) as TabId[]

/** 다음 미완료 레슨. 전부 완료했으면 레슨 1 (전체 복습) */
function nextIncomplete(completed: number[]): number {
  return LESSONS.find((l) => !completed.includes(l.id))?.id ?? LESSONS[0].id
}

export function App() {
  const [tab, setTab] = useState<TabId>('home')
  const audio = useMemo(() => createAudioEngine(), [])

  // 진도는 아직 메모리에만 있다 — localStorage 연동은 저장 PR에서 붙인다.
  // 저장 스키마와 같은 모양(completedLessons / currentStep)으로 들고 있어야
  // 다음 PR 에서 localStorage 어댑터만 갈아끼울 수 있다.
  const [completed, setCompleted] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [openLessonId, setOpenLessonId] = useState<number | null>(null)

  // 사양: "앱 시작 시 샘플 7개를 미리 fetch + decodeAudioData".
  // 디코드는 suspended 컨텍스트에서도 되므로 unlock 을 기다릴 필요가 없다.
  useEffect(() => {
    audio.loadSamples().catch(() => {})
  }, [audio])

  const currentLesson = nextIncomplete(completed)
  const openLesson = LESSONS.find((l) => l.id === openLessonId)
  const isReplay = openLesson ? completed.includes(openLesson.id) : false

  function handleComplete(lessonId: number) {
    setCompleted((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
    // currentLesson/currentStep 은 미완료 레슨 전용 — 완료했으면 스텝을 리셋한다
    setCurrentStep(0)
  }

  // 레슨 플레이는 탭 없이 전체 화면으로 열린다 (닫기 = 레슨 목록으로)
  if (openLesson) {
    return (
      <div className="app">
        <LessonPlay
          key={openLesson.id}
          lesson={openLesson}
          // 완료한 레슨을 다시 할 때는 처음부터 — 진도는 미완료 레슨 전용이다
          startStep={isReplay ? 0 : currentStep}
          hasNextLesson={LESSONS.some((l) => l.id === openLesson.id + 1)}
          audio={audio}
          onClose={() => {
            setOpenLessonId(null)
            setTab('lessons')
          }}
          onHome={() => {
            setOpenLessonId(null)
            setTab('home')
          }}
          onStepChange={(stepIndex) => {
            if (!isReplay) setCurrentStep(stepIndex)
          }}
          onComplete={handleComplete}
          onNextLesson={() => {
            const next = LESSONS.find((l) => l.id === openLesson.id + 1)
            setOpenLessonId(next?.id ?? null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="app">
      {/* 세로 화면 고정: 가로에서는 CSS 미디어쿼리로 이 안내만 덮어 보여준다 */}
      <div className="landscape-warn" role="alert">
        세로 화면으로 돌려주세요
      </div>

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
          <h1>{TAB_LABELS[id]}</h1>
          {id === 'lessons' ? (
            <LessonList
              completed={completed}
              currentLesson={currentLesson}
              currentStep={currentStep}
              onOpen={setOpenLessonId}
            />
          ) : null}
          {id === 'practice' ? <FreePlay audio={audio} /> : null}
          {id === 'home' ? <p className="placeholder">화면 구현 예정</p> : null}
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
    </div>
  )
}
