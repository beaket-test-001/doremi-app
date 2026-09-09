import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LESSONS } from '../data/lessons'
import { LessonList, TOAST_MS } from './LessonList'

describe('레슨 목록', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('레슨 5개를 번호와 제목으로 보여준다', () => {
    render(<LessonList completed={[]} currentLesson={1} onOpen={() => {}} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    for (const lesson of LESSONS) {
      expect(screen.getByText(new RegExp(`${lesson.id}\\. ${lesson.title}`))).toBeInTheDocument()
    }
  })

  it('상태 3종을 구분해 표시한다: 완료 · 진행 가능 · 잠김', () => {
    render(<LessonList completed={[1, 2]} currentLesson={3} onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /1\. / })).toHaveAttribute('data-state', 'done')
    expect(screen.getByRole('button', { name: /3\. / })).toHaveAttribute('data-state', 'open')
    expect(screen.getByRole('button', { name: /4\. / })).toHaveAttribute('data-state', 'locked')
  })

  it('완료한 레슨은 다시 열 수 있다', async () => {
    const onOpen = vi.fn()
    render(<LessonList completed={[1]} currentLesson={2} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('진행 가능한 레슨을 열 수 있다', async () => {
    const onOpen = vi.fn()
    render(<LessonList completed={[1]} currentLesson={2} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /2\. / }))
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('잠긴 레슨은 진입되지 않고 안내를 보여준다', async () => {
    const onOpen = vi.fn()
    render(<LessonList completed={[]} currentLesson={1} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /3\. / }))
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('이전 레슨을 먼저 완료하세요')
  })

  it('진행 중인 레슨은 스텝 진행률을 보여준다', () => {
    render(<LessonList completed={[1]} currentLesson={2} currentStep={3} onOpen={() => {}} />)
    // 레슨 2는 스텝 8개
    expect(screen.getByRole('button', { name: /2\. / })).toHaveTextContent('3/8')
  })

  it('잠금 안내는 잠시 뒤 사라진다', async () => {
    render(<LessonList completed={[]} currentLesson={1} onOpen={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /3\. / }))
    expect(screen.getByRole('status')).toHaveTextContent('이전 레슨을 먼저 완료하세요')
    act(() => void vi.advanceTimersByTime(TOAST_MS))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('같은 레슨을 다시 눌러도 안내가 다시 읽힌다', async () => {
    render(<LessonList completed={[]} currentLesson={1} onOpen={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /3\. / }))
    const first = screen.getByRole('status').getAttribute('data-seq')
    act(() => void vi.advanceTimersByTime(TOAST_MS))
    await userEvent.click(screen.getByRole('button', { name: /3\. / }))
    expect(screen.getByRole('status').getAttribute('data-seq')).not.toBe(first)
  })

  it('상태를 색·아이콘 외에 텍스트로도 알린다 (WCAG 1.4.1)', () => {
    render(<LessonList completed={[1]} currentLesson={2} onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /1\. / })).toHaveAccessibleName(/완료/)
    expect(screen.getByRole('button', { name: /2\. / })).toHaveAccessibleName(/진행 가능/)
    expect(screen.getByRole('button', { name: /3\. / })).toHaveAccessibleName(/잠김/)
  })

  it('잠긴 레슨도 동작하는 컨트롤이므로 disabled 로 만들지 않는다', () => {
    // 탭하면 안내 토스트를 띄워야 하므로 비활성화하면 사양을 지킬 수 없다
    render(<LessonList completed={[]} currentLesson={1} onOpen={() => {}} />)
    const locked = screen.getByRole('button', { name: /3\. / })
    expect(locked).not.toBeDisabled()
    expect(locked).not.toHaveAttribute('aria-disabled')
  })

  it('전부 완료하면 잠긴 레슨이 없다', () => {
    render(<LessonList completed={[1, 2, 3, 4, 5]} currentLesson={5} onOpen={() => {}} />)
    for (const lesson of LESSONS) {
      expect(screen.getByRole('button', { name: new RegExp(`${lesson.id}\\. `) })).toHaveAttribute(
        'data-state',
        'done',
      )
    }
  })
})
