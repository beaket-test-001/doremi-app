import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LESSONS } from '../data/lessons'
import type { AudioEngine } from '../services/audio'
import type { Lesson } from '../types'
import { FLASH_MS, LessonPlay } from './LessonPlay'

function fakeEngine(): AudioEngine {
  return { unlock: vi.fn(async () => {}), loadSamples: vi.fn(async () => {}), play: vi.fn() }
}

const L: Lesson = {
  id: 3,
  title: '테스트 레슨',
  steps: [
    { type: 'intro', text: '안내 문구예요' },
    { type: 'find_key', note: 'E4' },
    { type: 'play_sequence', label: '도레', notes: ['C4', 'D4'] },
  ],
}

function key(name: string) {
  return screen.getByRole('button', { name })
}

function press(name: string) {
  act(() => {
    key(name).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  })
}

describe('레슨 플레이', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('헤더', () => {
    it('레슨 제목과 스텝 진행도를 보여준다', () => {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      expect(screen.getByText(/레슨 3/)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3')
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    })

    it('✕ 는 확인을 받은 뒤 닫는다', async () => {
      const onClose = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          audio={fakeEngine()}
          onClose={onClose}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: /닫기/ }))
      expect(globalThis.confirm).toHaveBeenCalledWith(
        expect.stringContaining('진도는 저장돼요'),
      )
      expect(onClose).toHaveBeenCalled()
    })

    it('확인을 취소하면 닫지 않는다', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false))
      const onClose = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          audio={fakeEngine()}
          onClose={onClose}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: /닫기/ }))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('intro 스텝', () => {
    it('문구와 [다음] 버튼만 보여준다 (건반 없음)', () => {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      expect(screen.getByText('안내 문구예요')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '도' })).toBeNull()
    })

    it('[다음] 을 누르면 다음 스텝으로 넘어간다', async () => {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      expect(screen.getByText(/미.*찾아 눌러보세요/)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    })
  })

  describe('find_key 스텝', () => {
    async function goToFindKey() {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
    }

    it('찾을 계이름을 안내하고 건반 라벨을 켠다', async () => {
      await goToFindKey()
      expect(screen.getByText(/미.*찾아 눌러보세요/)).toBeInTheDocument()
      expect(screen.getByText('도')).toBeInTheDocument() // 라벨 ON
    })

    it('처음에는 목표 건반을 하이라이트하지 않는다', async () => {
      await goToFindKey()
      expect(key('미')).not.toHaveAttribute('data-highlight')
    })

    it('정답을 누르면 초록 플래시가 뜨고 다음 스텝으로 간다', async () => {
      await goToFindKey()
      press('미')
      expect(key('미')).toHaveAttribute('data-flash', 'correct')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(screen.getByText('도레')).toBeInTheDocument() // 다음 스텝(play_sequence)
    })

    it('오답을 누르면 빨간 플래시가 뜨고 같은 스텝에 머문다', async () => {
      await goToFindKey()
      press('도')
      expect(key('도')).toHaveAttribute('data-flash', 'wrong')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(screen.getByText(/미.*찾아 눌러보세요/)).toBeInTheDocument()
    })

    it('플래시는 150ms 후 사라진다', async () => {
      expect(FLASH_MS).toBe(150)
      await goToFindKey()
      press('도')
      expect(key('도')).toHaveAttribute('data-flash', 'wrong')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(key('도')).not.toHaveAttribute('data-flash')
    })

    it('오답 2회 누적 시 목표 건반을 하이라이트한다', async () => {
      await goToFindKey()
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(key('미')).toHaveAttribute('data-highlight', 'true')
    })

    it('오답도 누른 건반의 소리를 낸다', async () => {
      const audio = fakeEngine()
      render(<LessonPlay lesson={L} audio={audio} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      press('도')
      expect(audio.play).toHaveBeenCalledWith('C4')
    })

    it('지원 기기에서는 오답 시 짧게 진동한다', async () => {
      const vibrate = vi.fn()
      vi.stubGlobal('navigator', { ...navigator, vibrate })
      vi.stubGlobal('confirm', vi.fn(() => true))
      await goToFindKey()
      press('도')
      expect(vibrate).toHaveBeenCalled()
    })
  })

  describe('play_sequence 스텝', () => {
    async function goToSequence() {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      press('미')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
    }

    it('프레이즈 라벨과 계이름 시퀀스를 보여주고 현재 위치를 강조한다', async () => {
      await goToSequence()
      expect(screen.getByText('도레')).toBeInTheDocument()
      const seq = screen.getByTestId('sequence')
      expect(seq).toHaveTextContent('도레')
      expect(seq.querySelectorAll('[data-current="true"]')).toHaveLength(1)
      expect(seq.querySelector('[data-current="true"]')).toHaveTextContent('도')
    })

    it('눌러야 할 건반을 하이라이트한다', async () => {
      await goToSequence()
      expect(key('도')).toHaveAttribute('data-highlight', 'true')
      expect(key('레')).not.toHaveAttribute('data-highlight')
    })

    it('정답이면 다음 음으로 진행한다', async () => {
      await goToSequence()
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(key('레')).toHaveAttribute('data-highlight', 'true')
      expect(screen.getByTestId('sequence').querySelector('[data-current="true"]')).toHaveTextContent('레')
    })

    it('오답이면 같은 음부터 재시도한다', async () => {
      await goToSequence()
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(key('도')).toHaveAttribute('data-highlight', 'true')
    })
  })

  describe('완료 화면', () => {
    async function finish(lesson: Lesson) {
      const onComplete = vi.fn()
      render(
        <LessonPlay
          lesson={lesson}
          audio={fakeEngine()}
          onClose={() => {}}
          onComplete={onComplete}
          onNextLesson={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      press('미')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      return onComplete
    }

    it('마지막 스텝을 끝내면 완료 화면을 보여주고 onComplete 를 부른다', async () => {
      const onComplete = await finish(L)
      expect(screen.getByText(/레슨 3 완료/)).toBeInTheDocument()
      expect(onComplete).toHaveBeenCalledWith(3)
    })

    it('완료는 한 번만 통지한다', async () => {
      const onComplete = await finish(L)
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('마지막 레슨이 아니면 [다음 레슨] 과 [홈으로] 를 보여준다', async () => {
      await finish(L)
      expect(screen.getByRole('button', { name: '다음 레슨' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument()
    })

    it('레슨 5는 [홈으로] 만 보여준다', async () => {
      const lesson5: Lesson = { ...L, id: LESSONS.at(-1)!.id }
      await finish(lesson5)
      expect(screen.queryByRole('button', { name: '다음 레슨' })).toBeNull()
      expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument()
    })
  })

  describe('이어하기', () => {
    it('startStep 으로 중간 스텝부터 시작한다', () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          audio={fakeEngine()}
          onClose={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      expect(screen.getByText('도레')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    })
  })
})
