import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { FLASH_MS } from './screens/LessonPlay'

function pressKey(name: string) {
  act(() => {
    screen
      .getByRole('button', { name })
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  })
  act(() => void vi.advanceTimersByTime(FLASH_MS))
}

async function openLesson1() {
  await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
  await userEvent.click(screen.getByRole('button', { name: /1\. / }))
}

describe('App 셸', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

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

  it('레슨 탭에서 레슨 목록을 보여준다', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('레슨을 열면 탭바 없이 전체 화면으로 전환된다', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    expect(screen.getByText(/레슨 1/)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('첫 방문에는 레슨 1만 열 수 있다', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    expect(screen.getByRole('button', { name: /1\. / })).toHaveAttribute('data-state', 'open')
    expect(screen.getByRole('button', { name: /2\. / })).toHaveAttribute('data-state', 'locked')
  })

  it('가로 회전 안내를 렌더링한다', () => {
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('세로 화면으로 돌려주세요')
  })
})


describe('레슨 진도 (세션 내)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('중간에 ✕ 로 나갔다 돌아오면 같은 스텝에서 이어진다', async () => {
    render(<App />)
    await openLesson1()

    // intro → find_key(도) 통과 → find_key(레) 스텝에 도달
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')
    expect(screen.getByText('레를 찾아 눌러보세요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))

    expect(screen.getByText('레를 찾아 눌러보세요')).toBeInTheDocument()
  })

  it('레슨 목록에 진행 중 레슨의 스텝 진행률이 보인다', async () => {
    render(<App />)
    await openLesson1()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))

    // 레슨 1은 스텝 7개, 2개 완료
    expect(screen.getByRole('button', { name: /1\. / })).toHaveTextContent('2/7')
  })

  it('완료 화면 [홈으로] 는 홈 탭을 연다', async () => {
    render(<App />)
    await openLesson1()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    for (const note of ['도', '레', '미', '도', '레', '미', '미', '레', '도', '도', '레', '미', '레', '도'])
      pressKey(note)

    expect(screen.getByRole('heading', { name: /레슨 1 완료/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '홈으로' }))
    expect(screen.getByRole('tab', { name: /홈/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('완료한 레슨을 다시 하면 처음 스텝부터 시작한다', async () => {
    render(<App />)
    await openLesson1()
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    for (const note of ['도', '레', '미', '도', '레', '미', '미', '레', '도', '도', '레', '미', '레', '도'])
      pressKey(note)
    await userEvent.click(screen.getByRole('button', { name: '홈으로' }))

    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    // 다시 하기는 진도를 쓰지 않으므로 intro 부터
    expect(screen.getByText(/환영해요/)).toBeInTheDocument()
  })
})
