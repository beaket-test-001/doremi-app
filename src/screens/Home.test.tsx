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
    expect(screen.getAllByRole('gridcell')).toHaveLength(30)
  })

  it('연습한 날만 표시한다', () => {
    render(<Home {...base} practiceDates={['2026-09-02', '2026-09-03']} />)
    const marked = screen.getAllByRole('gridcell').filter((c) => c.dataset.practiced === 'true')
    expect(marked.map((c) => c.textContent)).toEqual(['2', '3'])
  })

  it('다른 달의 연습일은 이번 달에 표시하지 않는다', () => {
    render(<Home {...base} practiceDates={['2026-08-09', '2026-10-09']} />)
    expect(
      screen.getAllByRole('gridcell').filter((c) => c.dataset.practiced === 'true'),
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
    for (const cell of screen.getAllByRole('gridcell')) {
      expect(cell.tagName).not.toBe('BUTTON')
    }
  })
})

describe('홈 — 저장 불가 안내', () => {
  it('저장 가능하면 배너가 없다', () => {
    render(<Home {...base} />)
    expect(screen.queryByText(/저장되지 않아요/)).toBeNull()
  })

  it('저장 불가면 상단 배너를 보여준다', () => {
    render(<Home {...base} canSave={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '이 브라우저에서는 진도가 저장되지 않아요',
    )
  })
})
