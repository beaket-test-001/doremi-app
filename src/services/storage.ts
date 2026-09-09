import type { Progress } from '../types'

// 구현 가이드 '저장 스키마' 의 키를 그대로 쓴다
const PROGRESS_KEY = 'doremi.v1.progress'
const PRACTICE_KEY = 'doremi.v1.practice'
const PROBE_KEY = 'doremi.v1.probe'

/** 연습 날짜 보관 상한 (구현 가이드: 최대 400개) */
export const MAX_PRACTICE_DATES = 400

const YMD = /^\d{4}-\d{2}-\d{2}$/

export interface PracticeLog {
  dates: string[]
  /**
   * 자유 연습 음 수 누적. 사양의 "10음은 그날 누적, 세션 무관" 을 지키려면
   * 카운터가 남아 있어야 하는데 사양 스키마에는 없어 최소한으로 덧붙였다.
   * 하루치만 들고 있으면 되므로 날짜가 바뀌면 버린다.
   */
  freeNotes?: { date: string; count: number }
}

/** localStorage 와 같은 최소 인터페이스. 테스트에서 교체한다 */
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Storage {
  /** false 면 상단 배너로 "진도가 저장되지 않아요" 를 알려야 한다 */
  available: boolean
  loadProgress(): Progress
  saveProgress(progress: Progress): void
  loadPractice(): PracticeLog
  /** 오늘을 연습일로 기록. 새로 기록됐으면 true (스트릭 증가 이벤트 판정용) */
  markPracticed(date: string): boolean
  /** 자유 연습 음 수를 누적하고 그날 총합을 준다 */
  addFreeNotes(date: string, delta: number): number
}

const DEFAULT_PROGRESS: Progress = { completedLessons: [], currentLesson: 1, currentStep: 0 }

function isYmd(value: unknown): value is string {
  return typeof value === 'string' && YMD.test(value)
}

function parseProgress(raw: string | null): Progress {
  if (!raw) return { ...DEFAULT_PROGRESS }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    // 손상·구버전 데이터로 화면이 깨지지 않도록 필드마다 확인한다
    return {
      completedLessons: Array.isArray(data.completedLessons)
        ? data.completedLessons.filter((n): n is number => typeof n === 'number')
        : [],
      currentLesson:
        typeof data.currentLesson === 'number' ? data.currentLesson : DEFAULT_PROGRESS.currentLesson,
      currentStep: typeof data.currentStep === 'number' ? data.currentStep : 0,
    }
  } catch {
    return { ...DEFAULT_PROGRESS }
  }
}

function parsePractice(raw: string | null): PracticeLog {
  if (!raw) return { dates: [] }
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const dates = Array.isArray(data.dates) ? data.dates.filter(isYmd) : []
    const notes = data.freeNotes as PracticeLog['freeNotes']
    const freeNotes =
      notes && isYmd(notes.date) && typeof notes.count === 'number' ? notes : undefined
    return { dates, freeNotes }
  } catch {
    return { dates: [] }
  }
}

export function createStorage(backend: StorageBackend | undefined): Storage {
  // 시크릿 모드 등에서는 접근 자체가 던지므로 프로브로 확인한다
  let available = false
  if (backend) {
    try {
      backend.setItem(PROBE_KEY, '1')
      backend.removeItem(PROBE_KEY)
      available = true
    } catch {
      available = false
    }
  }

  function read(key: string): string | null {
    if (!backend) return null
    try {
      return backend.getItem(key)
    } catch {
      return null
    }
  }

  function write(key: string, value: unknown): void {
    if (!backend) return
    try {
      backend.setItem(key, JSON.stringify(value))
    } catch {
      // 저장 실패는 무시하고 앞으로 진행한다 (기록만 비활성)
    }
  }

  function loadPractice(): PracticeLog {
    return parsePractice(read(PRACTICE_KEY))
  }

  return {
    available,

    loadProgress: () => parseProgress(read(PROGRESS_KEY)),

    saveProgress: (progress) => write(PROGRESS_KEY, progress),

    loadPractice,

    markPracticed(date) {
      const log = loadPractice()
      if (log.dates.includes(date)) return false
      // 오래된 날짜부터 버린다
      const dates = [...log.dates, date].slice(-MAX_PRACTICE_DATES)
      write(PRACTICE_KEY, { ...log, dates })
      return true
    },

    addFreeNotes(date, delta) {
      const log = loadPractice()
      const previous = log.freeNotes?.date === date ? log.freeNotes.count : 0
      const count = previous + delta
      write(PRACTICE_KEY, { ...log, freeNotes: { date, count } })
      return count
    },
  }
}
