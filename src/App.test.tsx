import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App 셸', () => {
  it('하단 탭 3개(홈·레슨·연습)를 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /홈/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /레슨/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /연습/ })).toBeInTheDocument()
  })

  it('첫 진입 시 홈 탭이 선택되어 있다', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: /홈/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('탭을 누르면 해당 화면으로 전환된다', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    expect(screen.getByRole('tab', { name: /연습/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/연습/)
  })

  it('탭마다 aria-controls가 실제 존재하는 패널을 가리킨다', () => {
    const { container } = render(<App />)
    for (const tab of screen.getAllByRole('tab')) {
      const id = tab.getAttribute('aria-controls')!
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  })

  it('비활성 패널은 접근성 트리에서 빠진다', () => {
    render(<App />)
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('가로 회전 안내를 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('세로 화면으로 돌려주세요')
  })
})
