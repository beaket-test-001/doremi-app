import { useEffect, useRef, useState } from 'react'
import { LESSONS } from '../data/lessons'

/** 잠금 안내 토스트 표시 시간 */
export const TOAST_MS = 2000

type CardState = 'done' | 'open' | 'locked'

const BADGE: Record<CardState, string> = { done: '✅', open: '▶️', locked: '🔒' }
// 색·아이콘만으로 상태를 전달하면 스크린리더가 알 수 없다 (WCAG 1.4.1)
const STATE_LABEL: Record<CardState, string> = {
  done: '완료',
  open: '진행 가능',
  locked: '잠김',
}

export interface LessonListProps {
  completed: number[]
  /** 지금 진행 가능한(= 다음 미완료) 레슨 번호 */
  currentLesson: number
  /** 진행 중 레슨에서 완료한 스텝 수 (= 저장 스키마의 currentStep) */
  currentStep?: number
  onOpen: (lessonId: number) => void
}

export function LessonList({
  completed,
  currentLesson,
  currentStep = 0,
  onOpen,
}: LessonListProps) {
  // seq 를 함께 들고 있어야 같은 문구를 다시 눌렀을 때도 리렌더되어 재낭독된다.
  // 토스트가 사라진 뒤에도 값이 겹치지 않도록 카운터는 ref 로 계속 증가시킨다.
  const [toast, setToast] = useState<{ text: string; seq: number } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  function stateOf(id: number): CardState {
    if (completed.includes(id)) return 'done'
    return id === currentLesson ? 'open' : 'locked'
  }

  function handleClick(id: number, state: CardState) {
    if (state === 'locked') {
      seq.current += 1
      setToast({ text: '이전 레슨을 먼저 완료하세요', seq: seq.current })
      return
    }
    onOpen(id)
  }

  return (
    <>
      <ul className="lessons">
        {LESSONS.map((lesson) => {
          const state = stateOf(lesson.id)
          const showProgress = state === 'open' && currentStep > 0
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className="lessons__item"
                data-state={state}
                // aria-disabled 를 붙이지 않는다 — 잠긴 카드도 탭하면 안내 토스트를 띄우는
                // '동작하는' 컨트롤이다. 잠김 상태는 아래 sr-only 텍스트로 전달한다
                onClick={() => handleClick(lesson.id, state)}
              >
                <span className="lessons__badge" aria-hidden="true">
                  {BADGE[state]}
                </span>
                <span className="lessons__title">
                  {lesson.id}. {lesson.title}
                </span>
                {showProgress ? (
                  <span className="lessons__progress" aria-hidden="true">
                    {currentStep}/{lesson.steps.length}
                  </span>
                ) : null}
                <span className="sr-only">
                  {STATE_LABEL[state]}
                  {showProgress ? ` · ${lesson.steps.length}개 중 ${currentStep}개 스텝 완료` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {toast ? (
        <p className="toast" role="status" data-seq={toast.seq}>
          {toast.text}
        </p>
      ) : null}
    </>
  )
}
