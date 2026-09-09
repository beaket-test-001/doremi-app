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
