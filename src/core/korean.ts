const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3
const JONGSEONG_COUNT = 28

/** 마지막 글자에 받침이 있는지 */
function hasFinalConsonant(word: string): boolean {
  // codePointAt(length - 1) 은 서러게이트 페어에서 하위 서러게이트를 집는다.
  // 스프레드로 코드포인트 단위로 쪼개 마지막 글자를 정확히 얻는다.
  const last = [...word].at(-1)
  const code = last?.codePointAt(0)
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
