import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NOTE_FREQ } from '../types'
import { createAudioEngine } from './audio'

// Web Audio API 최소 목. 실제 소리는 내지 않고 호출만 기록한다.
function mockAudioContext() {
  const started: { freq: number; type: string; when: number }[] = []
  const gains: {
    gain: { setValueAtTime: Mock; exponentialRampToValueAtTime: Mock }
  }[] = []

  class FakeGainNode {
    gain = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    }
    connect = vi.fn()
  }

  const ctx = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    createGain: vi.fn(() => {
      const g = new FakeGainNode()
      gains.push(g)
      return g
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn((when: number) => {
          started.push({ freq: osc.frequency.value, type: osc.type, when })
        }),
        stop: vi.fn(),
      }
      return osc
    }),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    decodeAudioData: vi.fn(),
  }
  return { ctx, started, gains }
}

describe('오디오 엔진', () => {
  let mock: ReturnType<typeof mockAudioContext>

  beforeEach(() => {
    mock = mockAudioContext()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('unlock() 전에는 AudioContext를 만들지 않는다 (iOS 자동재생 정책)', () => {
    const factory = vi.fn(() => mock.ctx as unknown as AudioContext)
    createAudioEngine({ contextFactory: factory })
    expect(factory).not.toHaveBeenCalled()
  })

  it('첫 사용자 제스처에서 AudioContext를 만들고 resume한다', async () => {
    const factory = vi.fn(() => mock.ctx as unknown as AudioContext)
    const engine = createAudioEngine({ contextFactory: factory })
    await engine.unlock()
    expect(factory).toHaveBeenCalledTimes(1)
    expect(mock.ctx.resume).toHaveBeenCalled()
    expect(mock.ctx.state).toBe('running')
  })

  it('iOS 무음 스위치 대응: unlock 시 무음 오디오를 1회 재생한다', async () => {
    const silentPlay = vi.fn(async () => {})
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
      playSilentAudio: silentPlay,
    })
    await engine.unlock()
    expect(silentPlay).toHaveBeenCalledTimes(1)
  })

  it('무음 오디오 재생이 실패해도 AudioContext는 정상 resume된다', async () => {
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
      playSilentAudio: async () => {
        throw new Error('NotAllowedError')
      },
    })
    await expect(engine.unlock()).resolves.toBeUndefined()
    expect(mock.ctx.resume).toHaveBeenCalled()
    expect(mock.ctx.state).toBe('running')
  })

  it('unlock을 여러 번 호출해도 AudioContext는 하나만 만든다', async () => {
    const factory = vi.fn(() => mock.ctx as unknown as AudioContext)
    const engine = createAudioEngine({ contextFactory: factory })
    await engine.unlock()
    await engine.unlock()
    await engine.unlock()
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('샘플이 없으면 합성음 폴백으로 triangle 오실레이터를 정확한 주파수로 울린다', async () => {
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
    })
    await engine.unlock()
    engine.play('E4')
    expect(mock.started).toHaveLength(1)
    expect(mock.started[0].type).toBe('triangle')
    expect(mock.started[0].freq).toBeCloseTo(NOTE_FREQ.E4, 3)
  })

  it('합성음은 0.8초 exponential 감쇠를 건다', async () => {
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
    })
    await engine.unlock()
    engine.play('C4')
    const gain = mock.gains.at(-1)!
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      expect.any(Number),
      0.8,
    )
  })

  it('unlock 전에 play를 호출해도 예외를 던지지 않는다', () => {
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
    })
    expect(() => engine.play('C4')).not.toThrow()
    expect(mock.started).toHaveLength(0)
  })

  it('동시에 여러 음을 울릴 수 있다 (두 손가락 동시 터치)', async () => {
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
    })
    await engine.unlock()
    engine.play('C4')
    engine.play('G4')
    expect(mock.started).toHaveLength(2)
    expect(mock.started[0].freq).toBeCloseTo(NOTE_FREQ.C4, 3)
    expect(mock.started[1].freq).toBeCloseTo(NOTE_FREQ.G4, 3)
  })

  it('샘플 로드에 성공하면 합성음 대신 버퍼를 재생한다', async () => {
    const buffer = {} as AudioBuffer
    mock.ctx.decodeAudioData = vi.fn(async () => buffer)
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch

    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
      fetchImpl,
    })
    await engine.unlock()
    await engine.loadSamples()
    engine.play('C4')

    expect(mock.ctx.createBufferSource).toHaveBeenCalledTimes(1)
    expect(mock.started).toHaveLength(0)
  })

  it('샘플 로드가 실패하면 조용히 합성음 폴백을 유지한다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch
    const engine = createAudioEngine({
      contextFactory: () => mock.ctx as unknown as AudioContext,
      fetchImpl,
    })
    await engine.unlock()
    await expect(engine.loadSamples()).resolves.toBeUndefined()
    engine.play('C4')
    expect(mock.started).toHaveLength(1)
    expect(mock.started[0].type).toBe('triangle')
  })
})
