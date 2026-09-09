import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NOTES, SOLFEGE } from '../types'
import { Keyboard } from './Keyboard'

describe('건반', () => {
  it('흰건반 7개(도~시)만 렌더링한다', () => {
    render(<Keyboard onPress={() => {}} />)
    const keys = screen.getAllByRole('button')
    expect(keys).toHaveLength(7)
    // 검은건반은 v1.1 — 하나도 없어야 한다
    expect(screen.queryByText('#')).toBeNull()
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
    const key = screen.getByRole('button', { name: '미' })

    key.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(onPress).toHaveBeenCalledExactlyOnceWith('E4')
  })

  it('같은 건반을 click해도 onPress가 중복 호출되지 않는다', () => {
    const onPress = vi.fn()
    render(<Keyboard onPress={onPress} />)
    const key = screen.getByRole('button', { name: '파' })

    key.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    key.click()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('highlight로 지정한 건반만 눌러야 할 건반으로 표시한다', () => {
    render(<Keyboard onPress={() => {}} highlight="G4" />)
    expect(screen.getByRole('button', { name: '솔' })).toHaveAttribute(
      'data-highlight',
      'true',
    )
    expect(screen.getByRole('button', { name: '도' })).not.toHaveAttribute('data-highlight')
  })

  it('flash로 정답/오답 피드백 상태를 건반에 반영한다', () => {
    const { rerender } = render(
      <Keyboard onPress={() => {}} flash={{ note: 'C4', verdict: 'correct' }} />,
    )
    expect(screen.getByRole('button', { name: '도' })).toHaveAttribute(
      'data-flash',
      'correct',
    )

    rerender(<Keyboard onPress={() => {}} flash={{ note: 'D4', verdict: 'wrong' }} />)
    expect(screen.getByRole('button', { name: '레' })).toHaveAttribute('data-flash', 'wrong')
    expect(screen.getByRole('button', { name: '도' })).not.toHaveAttribute('data-flash')
  })

  it('건반 순서는 도·레·미·파·솔·라·시 이다', () => {
    render(<Keyboard onPress={() => {}} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['도', '레', '미', '파', '솔', '라', '시'])
  })
})
