import { useState } from 'react'
import { LESSONS } from '../data/lessons'

type State = 'done' | 'open' | 'locked'

const BADGE: Record<State, string> = { done: '✅', open: '▶️', locked: '🔒' }

export interface LessonListProps {
  completed: number[]
  /** 지금 진행 가능한(= 다음 미완료) 레슨 번호 */
  currentLesson: number
  /** 진행 중 레슨의 다음 스텝 인덱스 (0부터) */
  currentStep?: number
  onOpen: (lessonId: number) => void
}

export function LessonList({
  completed,
  currentLesson,
  currentStep = 0,
  onOpen,
}: LessonListProps) {
  const [toast, setToast] = useState('')

  function stateOf(id: number): State {
    if (completed.includes(id)) return 'done'
    return id === currentLesson ? 'open' : 'locked'
  }

  function handleClick(id: number, state: State) {
    if (state === 'locked') {
      setToast('이전 레슨을 먼저 완료하세요')
      return
    }
    onOpen(id)
  }

  return (
    <>
      <ul className="lessons">
        {LESSONS.map((lesson) => {
          const state = stateOf(lesson.id)
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className="lessons__item"
                data-state={state}
                onClick={() => handleClick(lesson.id, state)}
              >
                <span className="lessons__badge" aria-hidden="true">
                  {BADGE[state]}
                </span>
                <span className="lessons__title">
                  {lesson.id}. {lesson.title}
                </span>
                {state === 'open' && currentStep > 0 ? (
                  <span className="lessons__progress">
                    {currentStep}/{lesson.steps.length}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {/* 잠긴 레슨 안내. role=status 로 스크린리더에도 읽힌다 */}
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
    </>
  )
}
