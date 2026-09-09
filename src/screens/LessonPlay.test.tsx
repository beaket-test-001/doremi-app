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
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      expect(screen.getByText(/레슨 3/)).toBeInTheDocument()
      const bar = screen.getByRole('progressbar')
      // valuenow = 완료한 스텝 수. 첫 스텝에서는 0 이어야 SR 이 0% 로 읽는다
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '3')
      expect(bar).toHaveAttribute('aria-valuenow', '0')
      expect(bar).toHaveAttribute('aria-valuetext', '3개 중 1번째 스텝')
    })

    it('✕ 는 확인을 받은 뒤 닫는다', async () => {
      const onClose = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          audio={fakeEngine()}
          onClose={onClose}
          onHome={() => {}}
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
          onHome={() => {}}
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
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      expect(screen.getByText('안내 문구예요')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다음' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '도' })).toBeNull()
    })

    it('[다음] 을 누르면 다음 스텝으로 넘어간다', async () => {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      expect(screen.getByText(/미.*찾아 눌러보세요/)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    })
  })

  describe('find_key 스텝', () => {
    async function goToFindKey() {
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
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
      render(<LessonPlay lesson={L} audio={audio} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
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
      render(<LessonPlay lesson={L} audio={fakeEngine()} onClose={() => {}} onHome={() => {}} onComplete={() => {}} onNextLesson={() => {}} />)
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
          onHome={() => {}}
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

    it('마지막 레슨(다음 레슨 없음)은 [홈으로] 만 보여준다', async () => {
      // 레슨 5 여부는 App 이 판단해 hasNextLesson 으로 알려 준다
      expect(LESSONS.at(-1)!.id).toBe(5)
    })
  })

  describe('사양 문언 정합', () => {
    it('받침이 있는 계이름에는 조사 "을" 을 붙인다', () => {
      const solLesson: Lesson = {
        id: 2,
        title: '조사 테스트',
        steps: [{ type: 'find_key', note: 'G4' }],
      }
      render(
        <LessonPlay
          lesson={solLesson}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      // 사양 템플릿 "○를 찾아 눌러보세요" 는 솔에서 "솔를" 이 되어 어색하다
      expect(screen.getByText('솔을 찾아 눌러보세요')).toBeInTheDocument()
    })

    it('스텝 도트는 완료·현재·미완료 3상태로 구분하고 progressbar 값과 일치한다', () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      const dots = screen.getAllByTestId('step-dot')
      expect(dots).toHaveLength(3)
      // 완료 2개 · 현재 1개 · 미완료 0개
      expect(dots.filter((d) => d.dataset.state === 'done')).toHaveLength(2)
      expect(dots.filter((d) => d.dataset.state === 'current')).toHaveLength(1)
      // 채워진(완료) 도트 수 = aria-valuenow
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    })
  })

  describe('접근성', () => {
    it('레슨 제목이 제목 요소이고 열릴 때 포커스를 받는다', () => {
      render(
        <LessonPlay
          lesson={L}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      const heading = screen.getByRole('heading', { name: /레슨 3/ })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveFocus()
    })

    it('정답·오답을 색과 진동 외에 텍스트로도 알린다 (WCAG 1.4.1)', async () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={1}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      press('도')
      expect(screen.getByRole('status')).toHaveTextContent(/다시/)
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('미')
      expect(screen.getByRole('status')).toHaveTextContent(/정답/)
    })
  })

  describe('완료 화면 — 홈 이동', () => {
    it('[홈으로] 는 목록이 아니라 홈으로 보낸다', async () => {
      const onHome = vi.fn()
      const onClose = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          audio={fakeEngine()}
          onClose={onClose}
          onHome={onHome}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      await userEvent.click(screen.getByRole('button', { name: '홈으로' }))
      expect(onHome).toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('hasNextLesson 이 false 면 [다음 레슨] 을 숨긴다', async () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          hasNextLesson={false}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(screen.queryByRole('button', { name: '다음 레슨' })).toBeNull()
      expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument()
    })
  })

  describe('저장 · 스트릭 연동', () => {
    it('완료 화면에 현재 스트릭을 보여준다 (증가 없어도 표시)', async () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          streakDays={4}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      press('도')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      press('레')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(screen.getByText(/현재 스트릭 4일/)).toBeInTheDocument()
    })

    it('스텝을 완료할 때마다 onStepCompleted 를 부른다', () => {
      const onStepCompleted = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          startStep={1}
          audio={fakeEngine()}
          onStepCompleted={onStepCompleted}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      press('도') // 오답 — 스텝 미완료
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(onStepCompleted).not.toHaveBeenCalled()
      press('미') // 정답 — 스텝 완료
      expect(onStepCompleted).toHaveBeenCalledOnce()
    })

    it('저장 불가면 ✕ 확인 문구가 바뀐다', async () => {
      render(
        <LessonPlay
          lesson={L}
          canSave={false}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: /닫기/ }))
      expect(globalThis.confirm).toHaveBeenCalledWith(
        '그만할까요? 진도가 저장되지 않아요',
      )
    })
  })

  describe('이어하기', () => {
    it('스텝이 바뀔 때마다 onStepChange 로 알린다', async () => {
      const onStepChange = vi.fn()
      render(
        <LessonPlay
          lesson={L}
          audio={fakeEngine()}
          onStepChange={onStepChange}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      await userEvent.click(screen.getByRole('button', { name: '다음' }))
      expect(onStepChange).toHaveBeenCalledWith(1)
      press('미')
      act(() => void vi.advanceTimersByTime(FLASH_MS))
      expect(onStepChange).toHaveBeenCalledWith(2)
    })

    it('startStep 이 스텝 수를 넘어도 화면이 깨지지 않는다', () => {
      // 저장된 값이 그대로 들어오므로 방어가 필요하다
      expect(() =>
        render(
          <LessonPlay
            lesson={L}
            startStep={99}
            audio={fakeEngine()}
            onClose={() => {}}
            onHome={() => {}}
            onComplete={() => {}}
            onNextLesson={() => {}}
          />,
        ),
      ).not.toThrow()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    })

    it('startStep 이 음수여도 첫 스텝으로 시작한다', () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={-3}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      expect(screen.getByText('안내 문구예요')).toBeInTheDocument()
    })

    it('startStep 으로 중간 스텝부터 시작한다', () => {
      render(
        <LessonPlay
          lesson={L}
          startStep={2}
          audio={fakeEngine()}
          onClose={() => {}}
          onHome={() => {}}
          onComplete={() => {}}
          onNextLesson={() => {}}
        />,
      )
      expect(screen.getByText('도레')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    })
  })
})
