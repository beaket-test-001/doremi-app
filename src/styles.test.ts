import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 의 작업 디렉터리는 프로젝트 루트다
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

// 컴포넌트가 상태를 data-* 속성으로 내보내도 CSS 규칙이 없으면 화면에는 아무 변화가
// 없다. jsdom 은 스타일을 계산하지 않아 DOM 속성만 보는 테스트로는 이를 잡지 못한다.
// 실제로 플래시 CSS 가 빠진 채 223개 테스트가 전부 통과한 적이 있어 이 가드를 둔다.
describe('상태 속성마다 스타일 규칙이 있다', () => {
  it.each([
    // 화면 상세 사양 '색 규칙'
    ["눌러야 할 건반 파란 하이라이트", ".key[data-highlight='true']"],
    ['정답 초록 플래시', ".key[data-flash='correct']"],
    ['오답 빨간 플래시', ".key[data-flash='wrong']"],
    ['연습한 날 표시', ".calendar__day[data-practiced='true']"],
    ['레슨 카드 잠김', ".lessons__item[data-state='locked']"],
    ['레슨 카드 진행 가능', ".lessons__item[data-state='open']"],
    ['시퀀스 현재 음 강조', "[data-current='true']"],
  ])('%s → %s', (_label, selector) => {
    expect(css).toContain(selector)
  })

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
    const m = /transition:\s*background\s+(\d+)ms/.exec(css)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeLessThanOrEqual(150)
  })
})
