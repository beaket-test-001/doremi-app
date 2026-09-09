import { describe, expect, it } from 'vitest'
import { withObjectParticle } from './korean'

describe('목적격 조사 (을/를)', () => {
  it('받침이 없으면 를', () => {
    expect(withObjectParticle('도')).toBe('도를')
    expect(withObjectParticle('레')).toBe('레를')
    expect(withObjectParticle('미')).toBe('미를')
    expect(withObjectParticle('파')).toBe('파를')
    expect(withObjectParticle('라')).toBe('라를')
    expect(withObjectParticle('시')).toBe('시를')
  })

  it('받침이 있으면 을', () => {
    // 사양의 "○를 찾아 눌러보세요" 템플릿은 솔에서 "솔를" 이 되어 어색하다
    expect(withObjectParticle('솔')).toBe('솔을')
  })

  it('한글이 아닌 문자에는 를 을 붙인다 (기본값)', () => {
    expect(withObjectParticle('C4')).toBe('C4를')
  })

  it('빈 문자열에도 예외를 던지지 않는다', () => {
    expect(() => withObjectParticle('')).not.toThrow()
  })
})
