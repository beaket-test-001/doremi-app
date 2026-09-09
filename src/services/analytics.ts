// 사양서 7절 · 구현 가이드의 GA4 이벤트 6종.
// 측정 ID 발급 전까지는 콘솔 출력으로 대체 동작한다 (구현 가이드).
export type EventName =
  | 'app_open'
  | 'lesson_start'
  | 'lesson_complete'
  | 'practice_start'
  | 'practice_complete'
  | 'streak_updated'

type Params = Record<string, string | number>

type Gtag = (command: 'event', name: string, params: Params) => void

export interface Analytics {
  track(name: EventName, params?: Params): void
}

export interface AnalyticsOptions {
  /** 호출 시점에 조회한다 — gtag 스니펫이 앱보다 늦게 로드될 수 있다 */
  getGtag?: () => Gtag | undefined
  log?: (message: string) => void
}

export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  const {
    getGtag = () => (globalThis as { gtag?: Gtag }).gtag,
    log = (message: string) => console.info(message),
  } = options

  return {
    track(name, params = {}) {
      const gtag = getGtag()
      if (!gtag) {
        log(`[analytics] ${name} ${JSON.stringify(params)}`)
        return
      }
      try {
        gtag('event', name, params)
      } catch {
        // 광고 차단·확장 프로그램으로 실패해도 앱은 계속 동작해야 한다
      }
    },
  }
}
