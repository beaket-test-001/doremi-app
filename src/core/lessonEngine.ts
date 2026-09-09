import type { Lesson, Note, Step } from '../types'

// 사양: "find_key — 오답 2회 누적 시 목표 건반 하이라이트, 이후 정답 터치로 스텝 완료"
export const HIGHLIGHT_AFTER_WRONG = 2

/** 레슨 안의 현재 위치. 진도는 스텝 단위로 저장되므로 stepIndex 만 영속 대상이다. */
export interface LessonState {
  stepIndex: number
  /** play_sequence 안에서 지금 눌러야 할 음의 위치 */
  seqIndex: number
  /** find_key 오답 누적. 스텝이 바뀌면 초기화된다 */
  wrongCount: number
}

export interface PressOutcome {
  verdict: 'correct' | 'wrong'
  /** 재생할 음. 오답일 때도 "해당 건반 소리"를 내야 하므로 누른 음이 된다 */
  soundNote: Note
  next: LessonState
  stepCompleted: boolean
  lessonCompleted: boolean
}

export function initialState(stepIndex = 0): LessonState {
  return { stepIndex, seqIndex: 0, wrongCount: 0 }
}

export function currentStep(lesson: Lesson, state: LessonState): Step {
  return lesson.steps[state.stepIndex]
}

export function isLastStep(lesson: Lesson, state: LessonState): boolean {
  return state.stepIndex === lesson.steps.length - 1
}

/** 지금 눌러야 하는 음. intro 에는 없다 */
export function expectedNote(lesson: Lesson, state: LessonState): Note | undefined {
  const step = currentStep(lesson, state)
  if (step.type === 'find_key') return step.note
  if (step.type === 'play_sequence') return step.notes[state.seqIndex]
  return undefined
}

/** 파란 하이라이트로 표시할 건반 */
export function highlightNote(lesson: Lesson, state: LessonState): Note | undefined {
  // find_key 는 스스로 찾는 스텝이므로, 두 번 틀린 뒤에만 알려 준다.
  // 그 외에는 기대 음을 그대로 하이라이트한다 (분기를 expectedNote 에 위임)
  if (currentStep(lesson, state).type === 'find_key' && state.wrongCount < HIGHLIGHT_AFTER_WRONG)
    return undefined
  return expectedNote(lesson, state)
}

/** intro 의 [다음] 버튼 */
export function nextStep(state: LessonState): LessonState {
  return initialState(state.stepIndex + 1)
}

/** 건반 입력 판정. intro 스텝이면 판정 대상이 아니므로 null */
export function press(lesson: Lesson, state: LessonState, note: Note): PressOutcome | null {
  const step = currentStep(lesson, state)
  if (step.type === 'intro') return null

  const expected = expectedNote(lesson, state)
  if (note !== expected) {
    return {
      verdict: 'wrong',
      soundNote: note,
      // play_sequence 는 처음으로 돌아가지 않고 같은 음부터 재시도한다
      next: { ...state, wrongCount: state.wrongCount + 1 },
      stepCompleted: false,
      lessonCompleted: false,
    }
  }

  const isSequence = step.type === 'play_sequence'
  const hasMoreNotes = isSequence && state.seqIndex + 1 < step.notes.length

  if (hasMoreNotes) {
    return {
      verdict: 'correct',
      soundNote: note,
      next: { ...state, seqIndex: state.seqIndex + 1, wrongCount: 0 },
      stepCompleted: false,
      lessonCompleted: false,
    }
  }

  // 스텝 완료 — 레슨 통과 조건은 "마지막 play_sequence 를 끝까지 완주"
  const lessonCompleted = isLastStep(lesson, state)
  return {
    verdict: 'correct',
    soundNote: note,
    next: nextStep(state),
    stepCompleted: true,
    lessonCompleted,
  }
}
