import { describe, expect, it } from 'vitest'
import { LESSONS } from '../data/lessons'
import type { Lesson } from '../types'
import {
  HIGHLIGHT_AFTER_WRONG,
  expectedNote,
  highlightNote,
  initialState,
  isLastStep,
  press,
  nextStep,
} from './lessonEngine'

// 스텝 타입별 동작을 좁게 확인하기 위한 최소 레슨
const L: Lesson = {
  id: 99,
  title: '테스트용',
  steps: [
    { type: 'intro', text: '안내' },
    { type: 'find_key', note: 'E4' },
    { type: 'play_sequence', label: '도레', notes: ['C4', 'D4'] },
  ],
}

describe('레슨 엔진 — 기대 음', () => {
  it('intro 스텝에는 기대 음이 없다', () => {
    expect(expectedNote(L, initialState())).toBeUndefined()
  })

  it('find_key 는 지정된 건반을 기대한다', () => {
    expect(expectedNote(L, initialState(1))).toBe('E4')
  })

  it('play_sequence 는 현재 위치의 음을 기대한다', () => {
    expect(expectedNote(L, initialState(2))).toBe('C4')
    expect(expectedNote(L, { stepIndex: 2, seqIndex: 1, wrongCount: 0 })).toBe('D4')
  })
})

describe('레슨 엔진 — 하이라이트 규칙', () => {
  it('find_key 는 처음에 하이라이트하지 않는다 (스스로 찾게 한다)', () => {
    expect(highlightNote(L, initialState(1))).toBeUndefined()
  })

  it('find_key 오답 1회까지는 하이라이트하지 않는다', () => {
    expect(highlightNote(L, { stepIndex: 1, seqIndex: 0, wrongCount: 1 })).toBeUndefined()
  })

  it('find_key 오답 2회 누적 시 목표 건반을 하이라이트한다', () => {
    expect(HIGHLIGHT_AFTER_WRONG).toBe(2)
    expect(highlightNote(L, { stepIndex: 1, seqIndex: 0, wrongCount: 2 })).toBe('E4')
  })

  it('play_sequence 는 눌러야 할 건반을 항상 하이라이트한다', () => {
    expect(highlightNote(L, initialState(2))).toBe('C4')
  })

  it('intro 에는 하이라이트가 없다', () => {
    expect(highlightNote(L, initialState())).toBeUndefined()
  })
})

describe('레슨 엔진 — find_key', () => {
  it('정답이면 스텝을 완료하고 다음 스텝으로 넘어간다', () => {
    const r = press(L, initialState(1), 'E4')!
    expect(r.verdict).toBe('correct')
    expect(r.soundNote).toBe('E4')
    expect(r.stepCompleted).toBe(true)
    expect(r.next.stepIndex).toBe(2)
    expect(r.next.seqIndex).toBe(0)
    expect(r.next.wrongCount).toBe(0)
  })

  it('오답이면 누른 건반의 소리를 내고 같은 스텝에 머문다', () => {
    const r = press(L, initialState(1), 'C4')!
    expect(r.verdict).toBe('wrong')
    // 사양: "오답 → 빨간 플래시 + 해당 건반 소리"
    expect(r.soundNote).toBe('C4')
    expect(r.stepCompleted).toBe(false)
    expect(r.next.stepIndex).toBe(1)
    expect(r.next.wrongCount).toBe(1)
  })

  it('오답 2회 후 정답 터치로 스텝이 완료된다', () => {
    let s = initialState(1)
    s = press(L, s, 'C4')!.next
    s = press(L, s, 'D4')!.next
    expect(s.wrongCount).toBe(2)
    expect(highlightNote(L, s)).toBe('E4')

    const r = press(L, s, 'E4')!
    expect(r.verdict).toBe('correct')
    expect(r.stepCompleted).toBe(true)
  })

  it('오답 누적은 스텝이 바뀌면 초기화된다', () => {
    const wrong = press(L, initialState(1), 'C4')!
    const correct = press(L, wrong.next, 'E4')!
    expect(correct.next.wrongCount).toBe(0)
  })
})

describe('레슨 엔진 — play_sequence', () => {
  it('정답이면 다음 음으로 진행하고 스텝은 아직 끝나지 않는다', () => {
    const r = press(L, initialState(2), 'C4')!
    expect(r.verdict).toBe('correct')
    expect(r.next.seqIndex).toBe(1)
    expect(r.stepCompleted).toBe(false)
  })

  it('마지막 음까지 맞히면 스텝이 완료된다', () => {
    const r = press(L, { stepIndex: 2, seqIndex: 1, wrongCount: 0 }, 'D4')!
    expect(r.verdict).toBe('correct')
    expect(r.stepCompleted).toBe(true)
  })

  it('오답이면 처음으로 돌아가지 않고 같은 음부터 재시도한다', () => {
    const s = { stepIndex: 2, seqIndex: 1, wrongCount: 0 }
    const r = press(L, s, 'C4')!
    expect(r.verdict).toBe('wrong')
    expect(r.soundNote).toBe('C4')
    expect(r.next.seqIndex).toBe(1)
  })

  it('같은 음이 연속으로 나오는 시퀀스도 한 번에 두 칸 가지 않는다', () => {
    const twice: Lesson = {
      id: 98,
      title: '연타',
      steps: [{ type: 'play_sequence', label: '도도', notes: ['C4', 'C4'] }],
    }
    const first = press(twice, initialState(0), 'C4')!
    expect(first.next.seqIndex).toBe(1)
    expect(first.stepCompleted).toBe(false)
    expect(press(twice, first.next, 'C4')!.stepCompleted).toBe(true)
  })
})

describe('레슨 엔진 — 완료 판정', () => {
  it('마지막 스텝의 마지막 음을 맞히면 레슨이 완료된다', () => {
    const last = L.steps.length - 1
    const r = press(L, { stepIndex: last, seqIndex: 1, wrongCount: 0 }, 'D4')!
    expect(r.stepCompleted).toBe(true)
    expect(r.lessonCompleted).toBe(true)
  })

  it('중간 스텝 완료는 레슨 완료가 아니다', () => {
    expect(press(L, initialState(1), 'E4')!.lessonCompleted).toBe(false)
  })

  it('isLastStep 은 마지막 스텝에서만 참이다', () => {
    expect(isLastStep(L, initialState(1))).toBe(false)
    expect(isLastStep(L, initialState(2))).toBe(true)
  })
})

describe('레슨 엔진 — intro', () => {
  it('intro 에서는 건반 입력을 판정하지 않는다', () => {
    expect(press(L, initialState(), 'C4')).toBeNull()
  })

  it('[다음] 으로 다음 스텝으로 넘어간다', () => {
    expect(nextStep(initialState())).toEqual({ stepIndex: 1, seqIndex: 0, wrongCount: 0 })
  })
})

describe('레슨 엔진 — 실제 레슨 완주', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))(
    '레슨 %i 을 처음부터 끝까지 통과할 수 있다',
    (_id, lesson) => {
      let state = initialState()
      let completed = false
      let guard = 0

      while (!completed) {
        if (++guard > 500) throw new Error('레슨이 끝나지 않는다 — 진행 로직 무한 루프')
        const step = lesson.steps[state.stepIndex]
        if (step.type === 'intro') {
          state = nextStep(state)
          continue
        }
        const answer = expectedNote(lesson, state)!
        const r = press(lesson, state, answer)!
        expect(r.verdict).toBe('correct')
        completed = r.lessonCompleted
        state = r.next
      }

      expect(completed).toBe(true)
    },
  )

  it('레슨 5까지 모든 스텝 수의 합이 기대와 같다', () => {
    expect(LESSONS.map((l) => l.steps.length)).toEqual([7, 8, 4, 5, 6])
  })
})
