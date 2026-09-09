// 레슨 콘텐츠 정의서의 구조 정의를 그대로 옮긴 타입.
// 흰건반 7개(도~시)만 사용한다 — 검은건반은 v1.1 검토 대상.
export type Note = 'C4' | 'D4' | 'E4' | 'F4' | 'G4' | 'A4' | 'B4'

export const NOTES: Note[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']

export const SOLFEGE: Record<Note, string> = {
  C4: '도',
  D4: '레',
  E4: '미',
  F4: '파',
  G4: '솔',
  A4: '라',
  B4: '시',
}

// 평균율(A4 = 440Hz) 기준 주파수. 샘플 로드 실패 시 합성음 폴백에서 쓴다.
export const NOTE_FREQ: Record<Note, number> = {
  C4: 261.6256,
  D4: 293.6648,
  E4: 329.6276,
  F4: 349.2282,
  G4: 391.9954,
  A4: 440,
  B4: 493.8833,
}

// 스텝 타입은 3가지뿐이다 (레슨 콘텐츠 정의서 '공통 규칙')
export type Step =
  | { type: 'intro'; text: string }
  | { type: 'find_key'; note: Note }
  | { type: 'play_sequence'; label: string; notes: Note[] }

export interface Lesson {
  id: number
  title: string
  steps: Step[]
}

// localStorage 스키마 (구현 가이드 '저장 스키마')
export interface Progress {
  completedLessons: number[]
  currentLesson: number
  /** 다음에 진행할 스텝 인덱스 (0부터) */
  currentStep: number
}
