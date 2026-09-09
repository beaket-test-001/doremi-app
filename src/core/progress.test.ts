import { describe, expect, it } from 'vitest'
import type { Progress } from '../types'
import { completeLesson, nextIncompleteLesson, stepFor } from './progress'

const fresh: Progress = { completedLessons: [], currentLesson: 1, currentStep: 0 }

describe('다음 미완료 레슨', () => {
  it('아무것도 안 했으면 1', () => {
    expect(nextIncompleteLesson([])).toBe(1)
  })

  it('1·2를 완료하면 3', () => {
    expect(nextIncompleteLesson([1, 2])).toBe(3)
  })

  it('순서가 섞여 있어도 가장 앞의 미완료를 준다', () => {
    expect(nextIncompleteLesson([3, 1])).toBe(2)
  })

  it('전부 완료하면 1 (전체 복습)', () => {
    expect(nextIncompleteLesson([1, 2, 3, 4, 5])).toBe(1)
  })
})

describe('스텝 소속 확인', () => {
  it('저장된 레슨과 같으면 그 스텝을 준다', () => {
    expect(stepFor({ ...fresh, currentLesson: 2, currentStep: 3 }, 2)).toBe(3)
  })

  it('저장된 레슨과 다르면 0 을 준다', () => {
    // currentLesson/currentStep 은 한 쌍이다 — 다른 레슨의 스텝을 쓰면 안 된다
    expect(stepFor({ ...fresh, currentLesson: 2, currentStep: 3 }, 1)).toBe(0)
  })
})

describe('레슨 완료 전이', () => {
  it('완료 목록에 추가하고 다음 미완료 레슨으로 옮긴다', () => {
    expect(completeLesson(fresh, 1)).toEqual({
      completedLessons: [1],
      currentLesson: 2,
      currentStep: 0,
    })
  })

  it('마지막 레슨을 완료하면 currentLesson 은 1 로 돌아간다', () => {
    const almost: Progress = { completedLessons: [1, 2, 3, 4], currentLesson: 5, currentStep: 2 }
    expect(completeLesson(almost, 5)).toEqual({
      completedLessons: [1, 2, 3, 4, 5],
      currentLesson: 1,
      currentStep: 0,
    })
  })

  it('이미 완료한 레슨을 다시 완료하면 진도를 그대로 둔다', () => {
    // 사양: "완료 레슨 '다시 하기'는 진도를 저장하지 않음".
    // 여기서 currentStep 을 0 으로 밀면 진행 중인 다른 레슨의 진도가 사라진다
    const inProgress: Progress = { completedLessons: [1], currentLesson: 2, currentStep: 3 }
    expect(completeLesson(inProgress, 1)).toEqual(inProgress)
  })

  it('완료 목록에 중복을 만들지 않는다', () => {
    const done: Progress = { completedLessons: [1, 2], currentLesson: 3, currentStep: 0 }
    expect(completeLesson(done, 2).completedLessons).toEqual([1, 2])
  })
})
