import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NOTES, SOLFEGE } from '../types'
import { Keyboard } from './Keyboard'

function pointerDown(el: Element, init: PointerEventInit = {}) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, ...init }))
}

describe('건반', () => {
  it('흰건반 7개(도~시)만 렌더링한다', () => {
    render(<Keyboard onPress={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(7)
  })

  it('건반 순서는 도·레·미·파·솔·라·시 이다', () => {
    render(<Keyboard onPress={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['도', '레', '미', '파', '솔', '라', '시'])
  })

  it('각 건반은 계이름을 접근성 이름으로 갖는다', () => {
    render(<Keyboard onPress={() => {}} />)
    for (const note of NOTES) {
      expect(screen.getByRole('button', { name: SOLFEGE[note] })).toBeInTheDocument()
    }
  })

  it('showLabels가 false면 계이름 텍스트를 숨기되 접근성 이름은 남긴다', () => {
    render(<Keyboard onPress={() => {}} showLabels={false} />)
    expect(screen.queryByText('도')).toBeNull()
    expect(screen.getByRole('button', { name: '도' })).toBeInTheDocument()
  })

  it('showLabels가 true면 계이름 텍스트를 보여준다', () => {
    render(<Keyboard onPress={() => {}} showLabels />)
    expect(screen.getByText('도')).toBeInTheDocument()
    expect(screen.getByText('시')).toBeInTheDocument()
  })

  it('pointerdown 시점에 onPress를 부른다 (click보다 빠름)', () => {
    const onPress = vi.fn()
    render(<Keyboard onPress={onPress} />)
    pointerDown(screen.getByRole('button', { name: '미' }))
    expect(onPress).toHaveBeenCalledExactlyOnceWith('E4')
  })

  it('마우스 클릭은 pointerdown과 중복 발음하지 않는다', () => {
    const onPress = vi.fn()
    render(<Keyboard onPress={onPress} />)
    const key = screen.getByRole('button', { name: '파' })
    pointerDown(key)
    // 실제 마우스 클릭은 detail >= 1
    key.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('키보드·스크린리더 활성화(포인터 없는 click)로도 발음한다', () => {
    const onPress = vi.fn()
    render(<Keyboard onPress={onPress} />)
    // Enter/Space 와 VoiceOver·TalkBack 활성화는 detail 0 의 click 만 만든다
    screen
      .getByRole('button', { name: '라' })
      .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    expect(onPress).toHaveBeenCalledExactlyOnceWith('A4')
  })

  it('주 버튼이 아닌 입력(우클릭·휠클릭)은 발음하지 않는다', () => {
    const onPress = vi.fn()
    render(<Keyboard onPress={onPress} />)
    pointerDown(screen.getByRole('button', { name: '도' }), { button: 2 })
    expect(onPress).not.toHaveBeenCalled()
  })

  it('highlight로 지정한 건반만 눌러야 할 건반으로 표시한다', () => {
    render(<Keyboard onPress={() => {}} highlight="G4" />)
    expect(screen.getByRole('button', { name: '솔' })).toHaveAttribute(
      'data-highlight',
      'true',
    )
    expect(screen.getByRole('button', { name: '도' })).not.toHaveAttribute('data-highlight')
  })
})
