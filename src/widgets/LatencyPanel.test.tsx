import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TARGET_MS, lowerBoundMs, verdictOf } from '../core/diagnostics'
import type { AudioEngine, AudioStats } from '../services/audio'
import { LatencyPanel } from './LatencyPanel'

function stats(over: Partial<AudioStats> = {}): AudioStats {
  return {
    state: 'running',
    baseLatencyMs: 5,
    outputLatencyMs: 20,
    lastInputMs: 12,
    maxInputMs: 30,
    lastDispatchMs: 1.2,
    maxDispatchMs: 3.4,
    plays: 7,
    samplesLoaded: 0,
    ...over,
  }
}

function engine(get: () => AudioStats): AudioEngine & { reset: ReturnType<typeof vi.fn> } {
  const reset = vi.fn()
  return {
    unlock: vi.fn(async () => {}),
    loadSamples: vi.fn(async () => {}),
    play: vi.fn(),
    stats: get,
    resetStats: reset,
    reset,
  }
}

describe('하한 계산', () => {
  it('입력 + 예약 + 출력 을 더한다', () => {
    expect(lowerBoundMs(stats({ lastInputMs: 12, lastDispatchMs: 1, outputLatencyMs: 20 }))).toBe(33)
  })

  it('출력 지연이 없으면 그 몫을 0 으로 두고 하한만 계산한다', () => {
    expect(lowerBoundMs(stats({ lastInputMs: 12, lastDispatchMs: 1, outputLatencyMs: null }))).toBe(13)
  })

  it('측정 0회면 하한이 없다', () => {
    expect(lowerBoundMs(stats({ plays: 0 }))).toBeNull()
  })

  it('입력 지연을 못 재면 하한이 없다', () => {
    expect(lowerBoundMs(stats({ lastInputMs: null }))).toBeNull()
  })
})

describe('판정 문구', () => {
  it('측정 0회에는 합격을 말하지 않는다', () => {
    // 이전 구현은 plays 가 0 이어도 "통과" 를 출력했다
    const v = verdictOf(stats({ plays: 0 }))
    expect(v.level).toBe('unknown')
    expect(v.text).not.toMatch(/통과|≤/)
  })

  it('하한이 목표를 넘으면 확정 실패다', () => {
    const v = verdictOf(stats({ lastInputMs: 90, lastDispatchMs: 2, outputLatencyMs: 20 }))
    expect(v.level).toBe('fail')
    expect(v.text).toMatch(/확정 초과/)
  })

  it('출력 지연 미지원 브라우저에서는 하한을 보여주되 판정을 보류한다', () => {
    const v = verdictOf(stats({ lastInputMs: 10, lastDispatchMs: 1, outputLatencyMs: null }))
    expect(v.level).toBe('unknown')
    expect(v.text).toMatch(/판정 보류/)
    expect(v.text).toMatch(/11\.0ms/)
  })

  it('출력 지연을 알고 하한이 목표 이하면 하한을 명시한다 (합격이라 단정하지 않음)', () => {
    const v = verdictOf(stats({ lastInputMs: 10, lastDispatchMs: 1, outputLatencyMs: 20 }))
    expect(v.level).toBe('ok')
    expect(v.text).toMatch(/31\.0ms/)
    expect(v.text).toMatch(/물리 출력 구간 제외/)
    expect(TARGET_MS).toBe(100)
  })
})

describe('지연 진단 패널', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('입력·예약·브라우저 보고 지연을 구간별로 보여준다', () => {
    render(<LatencyPanel audio={engine(() => stats())} />)
    expect(screen.getByText(/입력\(터치→핸들러\): 12\.0ms · 최대 30\.0ms/)).toBeInTheDocument()
    expect(screen.getByText(/예약\(핸들러→재생\): 1\.2ms · 최대 3\.4ms/)).toBeInTheDocument()
    expect(screen.getByText(/base 5\.0ms · output 20\.0ms/)).toBeInTheDocument()
  })

  it('못 재는 구간이 있다는 것을 화면에 적는다', () => {
    render(<LatencyPanel audio={engine(() => stats())} />)
    expect(screen.getByText(/물리 출력 구간은 브라우저가 알려주지 않습니다/)).toBeInTheDocument()
  })

  it('초기화 버튼이 엔진 계측값을 되돌린다 (이상치 영구 고착 해제)', async () => {
    const e = engine(() => stats())
    render(<LatencyPanel audio={e} />)
    await userEvent.click(screen.getByRole('button', { name: '초기화' }))
    expect(e.reset).toHaveBeenCalledOnce()
  })

  it('닫기 버튼으로 패널을 없앨 수 있다', async () => {
    render(<LatencyPanel audio={engine(() => stats())} />)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByTestId('verdict')).toBeNull()
  })

  it('값이 변하지 않으면 다시 그리지 않는다', () => {
    const get = vi.fn(() => stats())
    render(<LatencyPanel audio={engine(get)} />)
    const before = screen.getByTestId('plays').textContent
    act(() => void vi.advanceTimersByTime(3200))
    expect(screen.getByTestId('plays').textContent).toBe(before)
  })

  it('값이 변하면 갱신한다', () => {
    let plays = 1
    render(<LatencyPanel audio={engine(() => stats({ plays: plays++ }))} />)
    const before = screen.getByTestId('plays').textContent
    act(() => void vi.advanceTimersByTime(1200))
    expect(screen.getByTestId('plays').textContent).not.toBe(before)
  })

  it('QA 전용이지만 접근 가능한 영역으로 둔다 (닫기 버튼이 있으므로)', () => {
    const { container } = render(<LatencyPanel audio={engine(() => stats())} />)
    expect(container.firstElementChild).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('region', { name: /오디오 지연 진단/ })).toBeInTheDocument()
  })

  it('샘플이 없으면 합성음으로 동작 중임을 알린다', () => {
    render(<LatencyPanel audio={engine(() => stats({ samplesLoaded: 0 }))} />)
    expect(screen.getByText(/합성음/)).toBeInTheDocument()
  })
})
