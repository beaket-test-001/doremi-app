import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../services/audio'
import { FreePlay } from './FreePlay'

function fakeEngine(): AudioEngine {
  return {
    unlock: vi.fn(async () => {}),
    loadSamples: vi.fn(async () => {}),
    play: vi.fn(),
  }
}

function press(name: string) {
  screen
    .getByRole('button', { name })
    .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
}

describe('자유 연습 화면', () => {
  it('건반과 계이름 라벨 토글만 보여준다', () => {
    render(<FreePlay audio={fakeEngine()} />)
    expect(screen.getAllByRole('button', { name: /^[도레미파솔라시]$/ })).toHaveLength(7)
    expect(screen.getByRole('switch', { name: /계이름/ })).toBeInTheDocument()
  })

  it('계이름 라벨은 기본 ON이다', () => {
    render(<FreePlay audio={fakeEngine()} />)
    expect(screen.getByRole('switch', { name: /계이름/ })).toBeChecked()
    expect(screen.getByText('도')).toBeInTheDocument()
  })

  it('토글을 끄면 계이름 텍스트가 사라진다', async () => {
    render(<FreePlay audio={fakeEngine()} />)
    await userEvent.click(screen.getByRole('switch', { name: /계이름/ }))
    expect(screen.getByRole('switch', { name: /계이름/ })).not.toBeChecked()
    expect(screen.queryByText('도')).toBeNull()
  })

  it('건반을 누르면 해당 음을 재생한다', () => {
    const audio = fakeEngine()
    render(<FreePlay audio={audio} />)
    press('솔')
    expect(audio.play).toHaveBeenCalledExactlyOnceWith('G4')
  })

  it('첫 터치에서 오디오를 unlock한다 (iOS 자동재생 정책)', () => {
    const audio = fakeEngine()
    render(<FreePlay audio={audio} />)
    press('도')
    expect(audio.unlock).toHaveBeenCalled()
  })

  it('연주할 때마다 unlock을 호출해도 되지만 재생은 매번 일어난다', () => {
    const audio = fakeEngine()
    render(<FreePlay audio={audio} />)
    press('도')
    press('레')
    press('도')
    expect(audio.play).toHaveBeenCalledTimes(3)
  })

  it('unlock이 실패해도 화면 조작은 계속 가능하다', async () => {
    const audio = fakeEngine()
    audio.unlock = vi.fn(async () => {
      throw new Error('NotAllowedError')
    })
    render(<FreePlay audio={audio} />)
    expect(() => press('도')).not.toThrow()
    await userEvent.click(screen.getByRole('switch', { name: /계이름/ }))
    expect(screen.getByRole('switch', { name: /계이름/ })).not.toBeChecked()
  })
})
