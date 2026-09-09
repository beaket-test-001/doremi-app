import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine, AudioStats } from '../services/audio'
import { TARGET_MS } from '../core/diagnostics'
import { LatencyPanel } from './LatencyPanel'

function stats(over: Partial<AudioStats> = {}): AudioStats {
  return {
    state: 'running',
    baseLatencyMs: 5,
    outputLatencyMs: 20,
    lastDispatchMs: 1.2,
    maxDispatchMs: 3.4,
    plays: 7,
    samplesLoaded: 0,
    ...over,
  }
}

function engine(s: AudioStats): AudioEngine {
  return {
    unlock: vi.fn(async () => {}),
    loadSamples: vi.fn(async () => {}),
    play: vi.fn(),
    stats: () => s,
  }
}

describe('지연 진단 패널', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('브라우저 보고 지연과 앱 처리 지연을 함께 보여준다', () => {
    render(<LatencyPanel audio={engine(stats())} />)
    expect(screen.getByText(/base 5\.0ms/)).toBeInTheDocument()
    expect(screen.getByText(/output 20\.0ms/)).toBeInTheDocument()
    expect(screen.getByText(/dispatch 1\.2ms/)).toBeInTheDocument()
    expect(screen.getByText(/max 3\.4ms/)).toBeInTheDocument()
  })

  it('추정 총 지연을 목표(100ms)와 비교해 판정한다', () => {
    render(<LatencyPanel audio={engine(stats({ outputLatencyMs: 20, maxDispatchMs: 3 }))} />)
    expect(TARGET_MS).toBe(100)
    expect(screen.getByTestId('verdict')).toHaveTextContent('통과')
  })

  it('목표를 넘으면 실패로 표시한다', () => {
    render(<LatencyPanel audio={engine(stats({ outputLatencyMs: 140, maxDispatchMs: 5 }))} />)
    expect(screen.getByTestId('verdict')).toHaveTextContent('초과')
  })

  it('outputLatency 미지원 브라우저에서는 판정을 보류한다', () => {
    render(<LatencyPanel audio={engine(stats({ outputLatencyMs: null }))} />)
    expect(screen.getByTestId('verdict')).toHaveTextContent('측정 불가')
  })

  it('샘플 로드 여부와 컨텍스트 상태를 보여준다', () => {
    render(<LatencyPanel audio={engine(stats({ samplesLoaded: 7, state: 'suspended' }))} />)
    expect(screen.getByText(/샘플 7\/7/)).toBeInTheDocument()
    expect(screen.getByText(/suspended/)).toBeInTheDocument()
  })

  it('샘플이 없으면 합성음으로 동작 중임을 알린다', () => {
    render(<LatencyPanel audio={engine(stats({ samplesLoaded: 0 }))} />)
    expect(screen.getByText(/합성음/)).toBeInTheDocument()
  })

  it('주기적으로 값을 갱신한다', () => {
    let plays = 0
    const live: AudioEngine = {
      unlock: vi.fn(async () => {}),
      loadSamples: vi.fn(async () => {}),
      play: vi.fn(),
      stats: () => stats({ plays: ++plays }),
    }
    render(<LatencyPanel audio={live} />)
    const before = screen.getByTestId('plays').textContent
    act(() => void vi.advanceTimersByTime(1200))
    expect(screen.getByTestId('plays').textContent).not.toBe(before)
  })

  it('스크린리더에는 노출하지 않는다 (QA 전용 오버레이)', () => {
    const { container } = render(<LatencyPanel audio={engine(stats())} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
