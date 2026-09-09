import { describe, expect, it } from 'vitest'
import { isDiagnosticsEnabled } from './diagnostics'

describe('진단 활성화 판정', () => {
  it('?diag=1 일 때만 켜진다', () => {
    expect(isDiagnosticsEnabled('?diag=1')).toBe(true)
    expect(isDiagnosticsEnabled('?diag=true')).toBe(true)
    expect(isDiagnosticsEnabled('')).toBe(false)
    expect(isDiagnosticsEnabled('?foo=1')).toBe(false)
    expect(isDiagnosticsEnabled('?diag=0')).toBe(false)
  })

  it('다른 쿼리와 함께 있어도 인식한다', () => {
    expect(isDiagnosticsEnabled('?a=1&diag=1&b=2')).toBe(true)
  })

  it('잘못된 쿼리 문자열에도 예외를 던지지 않는다', () => {
    expect(() => isDiagnosticsEnabled('?%')).not.toThrow()
  })
})
