const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3
const JONGSEONG_COUNT = 28

/** 마지막 글자에 받침이 있는지 */
function hasFinalConsonant(word: string): boolean {
  const code = word.codePointAt(word.length - 1)
  if (code === undefined || code < HANGUL_START || code > HANGUL_END) return false
  return (code - HANGUL_START) % JONGSEONG_COUNT !== 0
}

/**
 * 목적격 조사를 붙인다. 받침이 있으면 '을', 없으면 '를'.
 * 계이름 중 '솔' 만 받침이 있어 "솔를" 이 되는 것을 막는다.
 */
export function withObjectParticle(word: string): string {
  return `${word}${hasFinalConsonant(word) ? '을' : '를'}`
}
