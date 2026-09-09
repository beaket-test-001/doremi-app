import type { AudioStats } from '../services/audio'

/** 사양의 오디오 목표: 터치 → 소리 100ms 이내 */
export const TARGET_MS = 100

/**
 * QA 전용 진단 패널을 켤지 판정한다.
 * URL 에 ?diag=1 을 붙여서만 켜지므로 일반 사용자에게는 보이지 않는다.
 */
export function isDiagnosticsEnabled(search: string): boolean {
  try {
    const value = new URLSearchParams(search).get('diag')
    return value === '1' || value === 'true'
  } catch {
    return false
  }
}

/**
 * 터치 → 소리의 **하한**. 잴 수 있는 구간만 더한 값이다.
 *
 * 하한인 이유: 오디오 콜백 이후 스피커에서 실제로 소리가 나오는 물리 구간은
 * 브라우저가 알려주지 않는다. 그래서 이 값이 100ms 를 넘으면 **확정 실패**지만,
 * 밑이라고 해서 합격은 아니다. 특히 outputLatency 를 미구현한 브라우저
 * (iOS Safari)에서는 출력 몫이 아예 빠져 있으므로 판정할 수 없다.
 */
export function lowerBoundMs(s: AudioStats): number | null {
  if (s.plays === 0) return null // 측정 0회로 판정하지 않는다
  const input = s.lastInputMs
  const dispatch = s.lastDispatchMs
  if (input === null || dispatch === null) return null
  return input + dispatch + (s.outputLatencyMs ?? 0)
}

export function verdictOf(s: AudioStats): { text: string; level: 'fail' | 'unknown' | 'ok' } {
  if (s.plays === 0) return { text: '건반을 눌러 측정을 시작하세요', level: 'unknown' }

  const bound = lowerBoundMs(s)
  if (bound === null) return { text: '측정값 부족', level: 'unknown' }

  if (bound > TARGET_MS) {
    return { text: `확정 초과 — 하한 ${bound.toFixed(1)}ms > ${TARGET_MS}ms`, level: 'fail' }
  }
  if (s.outputLatencyMs === null) {
    // 출력 몫을 모르는 채 '통과' 라고 쓰면 느린 기기를 통과시킨다
    return {
      text: `판정 보류 — 하한 ${bound.toFixed(1)}ms (이 브라우저는 outputLatency 미지원: 출력 몫 미포함)`,
      level: 'unknown',
    }
  }
  return { text: `하한 ${bound.toFixed(1)}ms ≤ ${TARGET_MS}ms (물리 출력 구간 제외)`, level: 'ok' }
}
