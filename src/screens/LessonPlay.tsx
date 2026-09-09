import { useEffect, useRef, useState } from 'react'
import {
  currentStep,
  highlightNote,
  initialState,
  nextStep,
  press,
} from '../core/lessonEngine'
import type { AudioEngine } from '../services/audio'
import { SOLFEGE, type Lesson, type Note } from '../types'
import { Keyboard, type KeyFlash } from '../widgets/Keyboard'

/** 정답 초록 / 오답 빨간 플래시 표시 시간 (화면 상세 사양 '색 규칙') */
export const FLASH_MS = 150
const VIBRATE_MS = 30

/** 레슨 5 완료 후 복습 진입은 홈의 '전체 복습하기'로 일원화 — 여기서는 [홈으로]만 */
const LAST_LESSON_ID = 5

export interface LessonPlayProps {
  lesson: Lesson
  /** 이어하기 시작 스텝 (0부터) */
  startStep?: number
  audio: AudioEngine
  onClose: () => void
  onComplete: (lessonId: number) => void
  onNextLesson: () => void
}

export function LessonPlay({
  lesson,
  startStep = 0,
  audio,
  onClose,
  onComplete,
  onNextLesson,
}: LessonPlayProps) {
  const [state, setState] = useState(() => initialState(startStep))
  const [flash, setFlash] = useState<KeyFlash | undefined>()
  const [finished, setFinished] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 언마운트 시 남은 타이머를 정리한다 (닫기 직후 setState 경고 방지)
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  function showFlash(next: KeyFlash) {
    clearTimeout(flashTimer.current)
    setFlash(next)
    flashTimer.current = setTimeout(() => setFlash(undefined), FLASH_MS)
  }

  function handlePress(note: Note) {
    audio.unlock().catch(() => {})

    const outcome = press(lesson, state, note)
    if (!outcome) return // intro 스텝 — 건반이 없으므로 도달하지 않는다

    // 오답도 "해당 건반 소리"를 낸다 (화면 상세 사양)
    audio.play(outcome.soundNote)
    showFlash({ note, verdict: outcome.verdict })

    if (outcome.verdict === 'wrong') {
      // 지원 기기에서만 동작. 없으면 조용히 넘어간다
      navigator.vibrate?.(VIBRATE_MS)
    }

    setState(outcome.next)
    if (outcome.lessonCompleted) {
      setFinished(true)
      onComplete(lesson.id)
    }
  }

  function handleClose() {
    // TODO(저장 PR): localStorage 사용 불가 시 '진도가 저장되지 않아요'로 분기
    if (confirm('그만할까요? 진도는 저장돼요')) onClose()
  }

  if (finished) {
    return (
      <div className="lesson lesson--done">
        <p className="lesson__celebrate">🎉</p>
        <h2>레슨 {lesson.id} 완료!</h2>
        <div className="lesson__actions">
          {lesson.id !== LAST_LESSON_ID ? (
            <button type="button" className="btn btn--primary" onClick={onNextLesson}>
              다음 레슨
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose}>
            홈으로
          </button>
        </div>
      </div>
    )
  }

  const step = currentStep(lesson, state)
  const totalSteps = lesson.steps.length

  return (
    <div className="lesson">
      <header className="lesson__bar">
        <button type="button" className="lesson__close" aria-label="닫기" onClick={handleClose}>
          ✕
        </button>
        <span className="lesson__title">레슨 {lesson.id}</span>
        <span
          className="lesson__dots"
          role="progressbar"
          aria-label="스텝 진행"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={state.stepIndex + 1}
        >
          {lesson.steps.map((_, i) => (
            <span key={i} className={i <= state.stepIndex ? 'dot dot--on' : 'dot'} />
          ))}
        </span>
      </header>

      {step.type === 'intro' ? (
        <div className="lesson__body">
          <p className="lesson__intro">{step.text}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setState(nextStep(state))}
          >
            다음
          </button>
        </div>
      ) : (
        <>
          <div className="lesson__body">
            {step.type === 'find_key' ? (
              <p className="lesson__prompt">{`${SOLFEGE[step.note]}를 찾아 눌러보세요`}</p>
            ) : (
              <>
                <p className="lesson__phrase">{step.label}</p>
                <p className="lesson__sequence" data-testid="sequence">
                  {step.notes.map((note, i) => (
                    <span key={i} data-current={i === state.seqIndex ? 'true' : undefined}>
                      {SOLFEGE[note]}
                    </span>
                  ))}
                </p>
              </>
            )}
          </div>

          <Keyboard
            // find_key 는 건반 라벨 ON. play_sequence 는 하이라이트로 안내한다
            showLabels={step.type === 'find_key'}
            highlight={highlightNote(lesson, state)}
            flash={flash}
            onPress={handlePress}
          />
        </>
      )}
    </div>
  )
}
