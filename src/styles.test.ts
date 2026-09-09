import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 컴포넌트가 상태를 data-* 속성으로 내보내도 CSS 규칙이 없으면 화면에는 아무 변화가
// 없다. jsdom 은 스타일을 계산하지 않아 DOM 속성만 보는 테스트로는 이를 잡지 못한다.
// 실제로 플래시 CSS 가 빠진 채 223개 테스트가 전부 통과한 적이 있어 이 가드를 둔다.

/** 주석 안의 코드는 규칙이 아니다 — 주석 처리된 규칙을 통과시키면 가드가 공허해진다 */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

const root = process.cwd() // vitest 의 작업 디렉터리는 프로젝트 루트다
const rawCss = readFileSync(join(root, 'src/index.css'), 'utf-8')
const css = stripComments(rawCss)

/**
 * 스타일이 필요 없는 data-* 속성. 여기에 넣을 때는 이유를 함께 남긴다.
 * - testid: 테스트 조회용
 * - seq: 같은 문구를 다시 낭독시키기 위한 리렌더 카운터 (시각 표현 없음)
 */
const NON_VISUAL = new Set(['data-testid', 'data-seq'])

/** 컴포넌트가 실제로 내보내는 data-* 상태 속성 이름 */
function emittedStateAttributes(): string[] {
  const files = [
    'src/widgets/Keyboard.tsx',
    'src/screens/Home.tsx',
    'src/screens/LessonList.tsx',
    'src/screens/LessonPlay.tsx',
  ]
  const found = new Set<string>()
  for (const file of files) {
    const src = readFileSync(join(root, file), 'utf-8')
    for (const m of src.matchAll(/\bdata-([a-z-]+)=/g)) {
      const attr = `data-${m[1]}`
      if (!NON_VISUAL.has(attr)) found.add(attr)
    }
  }
  return [...found].sort()
}

describe('주석 처리된 규칙은 규칙으로 인정하지 않는다', () => {
  it('블록 주석 안의 선택자는 제거된다', () => {
    expect(stripComments("/* .key[data-flash='correct'] { background: red } */")).not.toContain(
      'data-flash',
    )
  })

  it('여러 줄 주석도 제거된다', () => {
    expect(stripComments('a {}\n/* line1\n.x[data-state] {}\nline3 */\nb {}')).not.toContain(
      'data-state',
    )
  })
})

describe('상태 속성마다 스타일 규칙이 있다', () => {
  it.each([
    // 화면 상세 사양 '색 규칙'
    ['눌러야 할 건반 파란 하이라이트', ".key[data-highlight='true']"],
    ['정답 초록 플래시', ".key[data-flash='correct']"],
    ['오답 빨간 플래시', ".key[data-flash='wrong']"],
    ['연습한 날 표시', ".calendar__day[data-practiced='true']"],
    ['레슨 카드 잠김', ".lessons__item[data-state='locked']"],
    ['레슨 카드 진행 가능', ".lessons__item[data-state='open']"],
    ['시퀀스 현재 음 강조', "[data-current='true']"],
    ['스텝 도트 완료', ".dot[data-state='done']"],
    ['스텝 도트 현재', ".dot[data-state='current']"],
  ])('%s → %s', (_label, selector) => {
    expect(css).toContain(selector)
  })

  it('컴포넌트가 내보내는 모든 상태 속성이 가드 목록에 들어 있다', () => {
    // 새 상태 속성을 추가하고 CSS·가드를 빠뜨리는 것을 막는다
    const guarded = new Set(
      [...css.matchAll(/\[(data-[a-z-]+)/g)].map((m) => m[1]),
    )
    for (const attr of emittedStateAttributes()) {
      expect(guarded, `${attr} 에 대응하는 CSS 규칙이 없다`).toContain(attr)
    }
  })
})

describe('플래시 표시 규칙', () => {
  it('플래시 규칙이 하이라이트 규칙보다 뒤에 온다 (같은 특이도라 순서가 승자를 결정)', () => {
    const highlight = css.indexOf("data-highlight='true'")
    const flash = css.indexOf("data-flash='correct'")
    expect(highlight).toBeGreaterThan(-1)
    expect(flash).toBeGreaterThan(highlight)
  })

  it('플래시는 전환 없이 즉시 나타난다', () => {
    // 120ms 트랜지션이 150ms 플래시 안에 들어가면 색이 드러나기 전에 해제된다
    expect(css).toMatch(/\.key\[data-flash\]\s*\{\s*transition:\s*none/)
  })

  it('건반 기본 전환은 플래시 표시 시간(150ms)을 넘지 않는다', () => {
    const m = /\.key\s*\{[^}]*transition:\s*background\s+(\d+)ms/.exec(css)
    expect(m, '.key 규칙 안의 transition 을 찾지 못했다').not.toBeNull()
    expect(Number(m![1])).toBeLessThanOrEqual(150)
  })
})
