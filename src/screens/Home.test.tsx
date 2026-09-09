import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

const base = {
  completed: [] as number[],
  practiceDates: [] as string[],
  today: '2026-09-09',
  onContinue: () => {},
}

describe('홈 — 와이어 정합', () => {
  it('화면 최상단에 앱 타이틀을 보여준다', () => {
    render(<Home {...base} />)
    expect(screen.getByRole('heading', { name: '도레미 🎹' })).toBeInTheDocument()
  })

  it('이어하기 버튼에 ▶ 글리프를 붙이되 접근성 이름은 깨끗하게 유지한다', () => {
    render(<Home {...base} completed={[1]} />)
    const cta = screen.getByRole('button', { name: '레슨 2 이어하기' })
    expect(cta).toHaveTextContent('▶')
    // 스크린리더가 "검은 오른쪽 삼각형" 을 읽지 않도록 장식은 aria-hidden
    expect(cta.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('전체 복습하기에는 ▶ 를 붙이지 않는다 (와이어 미규정)', () => {
    render(<Home {...base} completed={[1, 2, 3, 4, 5]} />)
    expect(screen.getByRole('button', { name: '전체 복습하기' })).not.toHaveTextContent('▶')
  })
})

describe('홈 — 스트릭 카드', () => {
  it('연속 일수를 보여준다', () => {
    render(<Home {...base} practiceDates={['2026-09-07', '2026-09-08', '2026-09-09']} />)
    expect(screen.getByText(/3일 연속/)).toBeInTheDocument()
  })

  it('스트릭 0일이면 시작을 권한다', () => {
    render(<Home {...base} />)
    expect(screen.getByText('오늘부터 시작해 볼까요?')).toBeInTheDocument()
  })

  it('오늘 아직 안 했어도 어제까지 이어졌으면 유지된다', () => {
    render(<Home {...base} practiceDates={['2026-09-07', '2026-09-08']} />)
    expect(screen.getByText(/2일 연속/)).toBeInTheDocument()
  })
})

describe('홈 — 이어하기 버튼', () => {
  it('첫 방문에는 "레슨 1 시작하기"', () => {
    render(<Home {...base} />)
    expect(screen.getByRole('button', { name: '레슨 1 시작하기' })).toBeInTheDocument()
  })

  it('진행 중이면 다음 미완료 레슨을 이어한다', () => {
    render(<Home {...base} completed={[1, 2]} />)
    expect(screen.getByRole('button', { name: '레슨 3 이어하기' })).toBeInTheDocument()
  })

  it('전부 완료하면 "전체 복습하기"', () => {
    render(<Home {...base} completed={[1, 2, 3, 4, 5]} />)
    expect(screen.getByRole('button', { name: '전체 복습하기' })).toBeInTheDocument()
  })

  it('누르면 해당 레슨 번호로 알린다', async () => {
    const onContinue = vi.fn()
    render(<Home {...base} completed={[1]} onContinue={onContinue} />)
    await userEvent.click(screen.getByRole('button', { name: '레슨 2 이어하기' }))
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('전체 복습하기는 레슨 1부터 시작한다', async () => {
    const onContinue = vi.fn()
    render(<Home {...base} completed={[1, 2, 3, 4, 5]} onContinue={onContinue} />)
    await userEvent.click(screen.getByRole('button', { name: '전체 복습하기' }))
    expect(onContinue).toHaveBeenCalledExactlyOnceWith(1)
  })
})

describe('홈 — 연습 캘린더', () => {
  it('이번 달 제목과 날짜 수를 보여준다', () => {
    render(<Home {...base} />)
    expect(screen.getByText('9월 연습 캘린더')).toBeInTheDocument()
    // 2026년 9월은 30일
    expect(screen.getAllByTestId('cal-day')).toHaveLength(30)
  })

  it('연습한 날만 표시한다', () => {
    render(<Home {...base} practiceDates={['2026-09-02', '2026-09-03']} />)
    const marked = screen.getAllByTestId('cal-day').filter((c) => c.dataset.practiced === 'true')
    expect(marked.map((c) => c.textContent)).toEqual(['2', '3'])
  })

  it('다른 달의 연습일은 이번 달에 표시하지 않는다', () => {
    render(<Home {...base} practiceDates={['2026-08-09', '2026-10-09']} />)
    expect(
      screen.getAllByTestId('cal-day').filter((c) => c.dataset.practiced === 'true'),
    ).toHaveLength(0)
  })

  it('요일 머리글을 보여주고 1일을 올바른 요일에 배치한다', () => {
    // 2026-09-01 은 화요일 → 월요일 시작 그리드에서 앞에 빈 칸 1개
    render(<Home {...base} />)
    expect(screen.getByText('월')).toBeInTheDocument()
    expect(screen.getByText('일')).toBeInTheDocument()
    expect(screen.getAllByTestId('cal-pad')).toHaveLength(1)
  })

  it('캘린더 칸은 탭 동작이 없다', () => {
    render(<Home {...base} practiceDates={['2026-09-02']} />)
    for (const cell of screen.getAllByTestId('cal-day')) {
      expect(cell.tagName).not.toBe('BUTTON')
    }
  })

  it('연습 여부를 색 외에 접근성 이름으로도 알린다', () => {
    render(<Home {...base} practiceDates={['2026-09-02']} />)
    expect(screen.getByLabelText('2일 연습함')).toBeInTheDocument()
    expect(screen.getByLabelText('3일')).toBeInTheDocument()
  })

  it('12월 · 1월 · 윤년 2월의 날짜 수를 올바르게 센다', () => {
    const { rerender } = render(<Home {...base} today="2026-12-15" />)
    expect(screen.getAllByTestId('cal-day')).toHaveLength(31)
    rerender(<Home {...base} today="2027-01-15" />)
    expect(screen.getAllByTestId('cal-day')).toHaveLength(31)
    rerender(<Home {...base} today="2028-02-15" />)
    expect(screen.getAllByTestId('cal-day')).toHaveLength(29)
  })
})

describe('홈 — 이어하기 라벨과 동작의 일치', () => {
  it('스텝을 진행한 상태면 "시작하기" 가 아니라 "이어하기" 다', () => {
    render(<Home {...base} hasProgress />)
    expect(screen.getByRole('button', { name: '레슨 1 이어하기' })).toBeInTheDocument()
  })
})
