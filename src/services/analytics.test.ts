import { describe, expect, it, vi } from 'vitest'
import { createAnalytics } from './analytics'

describe('분석 래퍼', () => {
  it('gtag 이 있으면 이벤트를 그대로 보낸다', () => {
    const gtag = vi.fn()
    createAnalytics({ getGtag: () => gtag }).track('lesson_start', { lesson_id: 3 })
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'lesson_start', { lesson_id: 3 })
  })

  it('속성이 없는 이벤트도 보낸다', () => {
    const gtag = vi.fn()
    createAnalytics({ getGtag: () => gtag }).track('app_open')
    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'app_open', {})
  })

  it('측정 ID 발급 전(gtag 없음)에는 콘솔로 대체 동작한다', () => {
    const log = vi.fn()
    createAnalytics({ getGtag: () => undefined, log }).track('practice_complete', { duration: 42 })
    expect(log).toHaveBeenCalledOnce()
    expect(String(log.mock.calls[0][0])).toContain('practice_complete')
  })

  it('gtag 이 던져도 앱을 멈추지 않는다', () => {
    const analytics = createAnalytics({
      getGtag: () => () => {
        throw new Error('blocked by extension')
      },
    })
    expect(() => analytics.track('app_open')).not.toThrow()
  })

  it('gtag 은 호출 시점에 조회한다 (스니펫이 늦게 로드될 수 있다)', () => {
    let gtag: ((...args: unknown[]) => void) | undefined
    const analytics = createAnalytics({ getGtag: () => gtag })
    analytics.track('app_open') // 아직 없음 — 콘솔 폴백
    const late = vi.fn()
    gtag = late
    analytics.track('lesson_complete', { lesson_id: 1, duration: 10 })
    expect(late).toHaveBeenCalledWith('event', 'lesson_complete', { lesson_id: 1, duration: 10 })
  })
})
