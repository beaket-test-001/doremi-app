import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_PRACTICE_DATES, createStorage } from './storage'

function memoryBackend() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

function throwingBackend() {
  return {
    getItem: () => {
      throw new DOMException('SecurityError')
    },
    setItem: () => {
      throw new DOMException('QuotaExceededError')
    },
    removeItem: () => {
      throw new DOMException('SecurityError')
    },
  }
}

describe('저장소 — 정상 동작', () => {
  let backend: ReturnType<typeof memoryBackend>

  beforeEach(() => {
    backend = memoryBackend()
  })

  it('사용 가능 여부를 알려 준다', () => {
    expect(createStorage(backend).available).toBe(true)
  })

  it('진도가 없으면 첫 방문 기본값을 준다', () => {
    expect(createStorage(backend).loadProgress()).toEqual({
      completedLessons: [],
      currentLesson: 1,
      currentStep: 0,
    })
  })

  it('진도를 사양 스키마의 키로 저장한다', () => {
    const s = createStorage(backend)
    s.saveProgress({ completedLessons: [1, 2], currentLesson: 3, currentStep: 2 })
    expect(JSON.parse(backend._map.get('doremi.v1.progress')!)).toEqual({
      completedLessons: [1, 2],
      currentLesson: 3,
      currentStep: 2,
    })
  })

  it('저장한 진도를 그대로 읽는다', () => {
    const s = createStorage(backend)
    const progress = { completedLessons: [1], currentLesson: 2, currentStep: 4 }
    s.saveProgress(progress)
    expect(createStorage(backend).loadProgress()).toEqual(progress)
  })

  it('연습 날짜를 사양 스키마의 키로 저장한다', () => {
    const s = createStorage(backend)
    s.markPracticed('2026-09-09')
    expect(JSON.parse(backend._map.get('doremi.v1.practice')!).dates).toEqual(['2026-09-09'])
  })

  it('같은 날을 두 번 기록해도 하루만 남는다', () => {
    const s = createStorage(backend)
    s.markPracticed('2026-09-09')
    s.markPracticed('2026-09-09')
    expect(s.loadPractice().dates).toEqual(['2026-09-09'])
  })

  it('markPracticed 는 새로 기록됐는지 알려 준다', () => {
    const s = createStorage(backend)
    expect(s.markPracticed('2026-09-09')).toBe(true)
    expect(s.markPracticed('2026-09-09')).toBe(false)
  })

  it('연습 날짜는 최대 400개까지만 보관한다', () => {
    const s = createStorage(backend)
    const dates = Array.from({ length: MAX_PRACTICE_DATES + 50 }, (_, i) => {
      const d = new Date(2025, 0, 1 + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    for (const date of dates) s.markPracticed(date)

    const stored = s.loadPractice().dates
    expect(stored).toHaveLength(MAX_PRACTICE_DATES)
    // 오래된 것부터 버린다
    expect(stored.at(-1)).toBe(dates.at(-1))
    expect(stored).not.toContain(dates[0])
  })

  it('자유 연습 음 수를 날짜별로 누적한다 (세션 무관)', () => {
    const s = createStorage(backend)
    expect(s.addFreeNotes('2026-09-09', 4)).toBe(4)
    expect(s.addFreeNotes('2026-09-09', 3)).toBe(7)
    // 다른 세션에서 읽어도 누적값이 유지된다
    expect(createStorage(backend).addFreeNotes('2026-09-09', 1)).toBe(8)
  })

  it('날짜가 바뀌면 음 수 누적이 초기화된다', () => {
    const s = createStorage(backend)
    s.addFreeNotes('2026-09-09', 9)
    expect(s.addFreeNotes('2026-09-10', 1)).toBe(1)
  })
})

describe('저장소 — 사용 불가 (시크릿 모드 등)', () => {
  it('available 이 false 다', () => {
    expect(createStorage(throwingBackend()).available).toBe(false)
  })

  it('읽기는 기본값을 주고 예외를 던지지 않는다', () => {
    const s = createStorage(throwingBackend())
    expect(() => s.loadProgress()).not.toThrow()
    expect(s.loadProgress().currentLesson).toBe(1)
    expect(s.loadPractice().dates).toEqual([])
  })

  it('쓰기는 조용히 무시된다', () => {
    const s = createStorage(throwingBackend())
    expect(() => s.saveProgress({ completedLessons: [], currentLesson: 1, currentStep: 0 })).not.toThrow()
    expect(() => s.markPracticed('2026-09-09')).not.toThrow()
    expect(() => s.addFreeNotes('2026-09-09', 1)).not.toThrow()
  })

  it('backend 자체가 없는 환경에서도 동작한다', () => {
    const s = createStorage(undefined)
    expect(s.available).toBe(false)
    expect(s.loadProgress().currentLesson).toBe(1)
  })
})

describe('저장소 — 손상된 데이터', () => {
  it('JSON 이 깨져 있으면 기본값으로 되돌린다', () => {
    const backend = memoryBackend()
    backend.setItem('doremi.v1.progress', '{not json')
    backend.setItem('doremi.v1.practice', 'nope')
    const s = createStorage(backend)
    expect(s.loadProgress()).toEqual({ completedLessons: [], currentLesson: 1, currentStep: 0 })
    expect(s.loadPractice().dates).toEqual([])
  })

  it('타입이 어긋난 값은 무시한다', () => {
    const backend = memoryBackend()
    backend.setItem(
      'doremi.v1.progress',
      JSON.stringify({ completedLessons: 'nope', currentLesson: null, currentStep: 'x' }),
    )
    backend.setItem('doremi.v1.practice', JSON.stringify({ dates: 'nope' }))
    const s = createStorage(backend)
    expect(s.loadProgress()).toEqual({ completedLessons: [], currentLesson: 1, currentStep: 0 })
    expect(s.loadPractice().dates).toEqual([])
  })

  it('날짜 배열 안의 잘못된 항목만 걸러낸다', () => {
    const backend = memoryBackend()
    backend.setItem(
      'doremi.v1.practice',
      JSON.stringify({ dates: ['2026-09-09', 42, null, '엉망', '2026-09-08'] }),
    )
    expect(createStorage(backend).loadPractice().dates).toEqual(['2026-09-09', '2026-09-08'])
  })
})
