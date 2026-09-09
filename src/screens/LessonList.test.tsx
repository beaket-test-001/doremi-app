import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LESSONS } from '../data/lessons'
import { LessonList } from './LessonList'

describe('레슨 목록', () => {
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
