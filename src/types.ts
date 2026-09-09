// 레슨 콘텐츠 정의서(Notion)의 구조 정의를 그대로 옮긴 타입.
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

export type Step =
  | { type: 'intro'; text: string }
  | { type: 'find_key'; note: Note }
  | { type: 'play_sequence'; label: string; notes: Note[] }

export interface Lesson {
  id: number
  title: string
  steps: Step[]
}

// localStorage 스키마 (구현 가이드 '저장 스키마' 절)
export interface Progress {
  completedLessons: number[]
  currentLesson: number
  currentStep: number
}

export interface PracticeLog {
  dates: string[] // YYYY-MM-DD (기기 로컬 시간)
}
