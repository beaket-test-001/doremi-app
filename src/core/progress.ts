import { LESSONS } from '../data/lessons'
import type { Progress } from '../types'

/**
 * 다음 미완료 레슨. 전부 완료했으면 레슨 1 (홈의 '전체 복습하기').
 * 홈 '이어하기' 와 레슨 목록의 '진행 가능' 판정이 이 함수 하나를 공유한다.
 */
export function nextIncompleteLesson(completed: number[]): number {
  return LESSONS.find((l) => !completed.includes(l.id))?.id ?? LESSONS[0].id
}

/**
 * 저장된 스텝을 쓸 수 있는지 확인해 준다.
 * currentLesson 과 currentStep 은 한 쌍이므로, 다른 레슨을 열 때는 0 부터다.
 */
export function stepFor(progress: Progress, lessonId: number): number {
  return progress.currentLesson === lessonId ? progress.currentStep : 0
}

/**
 * 레슨 완료 시의 진도 전이.
 *
 * 이미 완료한 레슨을 다시 완주한 경우(복습)에는 진도를 건드리지 않는다 —
 * 여기서 currentStep 을 0 으로 밀면 진행 중인 다른 레슨의 진도가 사라진다.
 */
export function completeLesson(progress: Progress, lessonId: number): Progress {
  if (progress.completedLessons.includes(lessonId)) return progress

  const completedLessons = [...progress.completedLessons, lessonId]
  return {
    completedLessons,
    // currentLesson/currentStep 은 미완료 레슨 전용 — 다음 레슨으로 리셋
    currentLesson: nextIncompleteLesson(completedLessons),
    currentStep: 0,
  }
}
