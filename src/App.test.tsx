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
})
