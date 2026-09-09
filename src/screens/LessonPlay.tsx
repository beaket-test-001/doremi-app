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

const VERDICT_TEXT = { correct: '정답이에요', wrong: '다시 눌러보세요' } as const

export interface LessonPlayProps {
  lesson: Lesson
  /** 이어하기 시작 스텝 (0부터). 저장된 값이 그대로 들어오므로 범위를 신뢰하지 않는다 */
  startStep?: number
  /** 다음 레슨이 있는지. 레슨 5 완료 화면은 [홈으로]만 보여야 한다 */
  hasNextLesson?: boolean
  /** 완료 화면에 보여줄 현재 스트릭 일수 (증가 없어도 동일하게 표시) */
  streakDays?: number
  /** false 면 ✕ 확인 문구를 '진도가 저장되지 않아요' 로 바꾼다 */
  canSave?: boolean
  audio: AudioEngine
  /** ✕ — 확인 후 레슨 목록으로 */
  onClose: () => void
  /** 완료 화면의 [홈으로] */
  onHome: () => void
  /** 진도 저장용 — 스텝이 바뀔 때마다 다음 스텝 인덱스를 알린다 */
  onStepChange?: (stepIndex: number) => void
  /** 스텝 1개를 완료할 때마다 호출 — 그날 '연습함' 판정에 쓰인다 */
  onStepCompleted?: () => void
  onComplete: (lessonId: number) => void
  onNextLesson: () => void
}

export function LessonPlay({
  lesson,
  startStep = 0,
  hasNextLesson = true,
  streakDays = 0,
  canSave = true,
  audio,
  onClose,
  onHome,
  onStepChange,
  onStepCompleted,
  onComplete,
  onNextLesson,
}: LessonPlayProps) {
  const [state, setState] = useState(() =>
    // 저장된 스텝이 데이터 변경으로 범위를 벗어날 수 있다 — clamp 없이 쓰면 화면이 백지가 된다
    initialState(Math.min(Math.max(startStep, 0), lesson.steps.length - 1)),
  )
  const [flash, setFlash] = useState<KeyFlash | undefined>()
  const [announce, setAnnounce] = useState<{ text: string; seq: number } | null>(null)
  const [finished, setFinished] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const announceSeq = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 전체 화면으로 트리가 교체되면 포커스가 body 로 날아간다 — 제목으로 옮겨 준다
  useEffect(() => {
    headingRef.current?.focus()
  }, [finished])

  // 언마운트 시 남은 타이머를 정리한다 (닫기 직후 setState 경고 방지)
  useEffect(() => () => clearTimeout(flashTimer.current), [])

  function showFlash(next: KeyFlash) {
    clearTimeout(flashTimer.current)
    setFlash(next)
    flashTimer.current = setTimeout(() => setFlash(undefined), FLASH_MS)
  }

  function goTo(next: typeof state) {
    setState(next)
    if (next.stepIndex !== state.stepIndex) onStepChange?.(next.stepIndex)
  }

  function handlePress(note: Note) {
    audio.unlock().catch(() => {})

    const outcome = press(lesson, state, note)
    if (!outcome) return // intro 스텝 — 건반이 없으므로 도달하지 않는다

    // 오답도 "해당 건반 소리"를 낸다 (화면 상세 사양)
    audio.play(outcome.soundNote)
    showFlash({ note, verdict: outcome.verdict })

    // 색과 진동만으로 판정을 전달하면 스크린리더·색약 사용자가 알 수 없다 (WCAG 1.4.1)
    announceSeq.current += 1
    setAnnounce({ text: VERDICT_TEXT[outcome.verdict], seq: announceSeq.current })

    if (outcome.verdict === 'wrong') {
      // 지원 기기에서만 동작. 없으면 조용히 넘어간다
      navigator.vibrate?.(VIBRATE_MS)
    }

    // 사양: "'연습함' 인정: 레슨 스텝 1개 이상 완료"
    if (outcome.stepCompleted) onStepCompleted?.()

    goTo(outcome.next)
    if (outcome.lessonCompleted) {
      setFinished(true)
      onComplete(lesson.id)
    }
  }

  function handleClose() {
    const tail = canSave ? '진도는 저장돼요' : '진도가 저장되지 않아요'
    if (confirm(`그만할까요? ${tail}`)) onClose()
  }

  if (finished) {
    return (
      <div className="lesson lesson--done">
        <p className="lesson__celebrate" aria-hidden="true">
          🎉
        </p>
        <h1 className="lesson__doneTitle" ref={headingRef} tabIndex={-1}>
          레슨 {lesson.id} 완료!
        </h1>
        {/* 스트릭은 증가 없어도 현재 값을 그대로 보여준다 (화면 상세 사양) */}
        <p className="lesson__streak">🔥 현재 스트릭 {streakDays}일</p>
        <div className="lesson__actions">
          {hasNextLesson ? (
            <button type="button" className="btn btn--primary" onClick={onNextLesson}>
              다음 레슨
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onHome}>
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
        <h1 className="lesson__title" ref={headingRef} tabIndex={-1}>
          레슨 {lesson.id}
        </h1>
        <span
          className="lesson__dots"
          role="progressbar"
          aria-label="스텝 진행"
          // valuenow 는 '완료한 스텝 수'. 첫 스텝에서 0% 로 읽혀야 한다
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={state.stepIndex}
          aria-valuetext={`${totalSteps}개 중 ${state.stepIndex + 1}번째 스텝`}
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
            onClick={() => goTo(nextStep(state))}
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

          {/* 판정을 텍스트로도 알린다. 같은 문구가 반복돼도 재낭독되도록 seq 를 key 로 쓴다 */}
          <p className="sr-only" role="status" key={announce?.seq}>
            {announce?.text ?? ''}
          </p>

          <Keyboard
            // 레슨 플레이 와이어는 두 스텝 모두 건반에 계이름 라벨이 붙어 있다
            showLabels
            highlight={highlightNote(lesson, state)}
            flash={flash}
            onPress={handlePress}
          />
        </>
      )}
    </div>
  )
}
