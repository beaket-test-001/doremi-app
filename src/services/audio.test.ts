import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NOTE_FREQ } from '../types'
import { createAudioEngine } from './audio'

// Web Audio API 최소 목. 실제 소리는 내지 않고 호출만 기록한다.
function mockAudioContext() {
  const started: { freq: number; type: string; when: number }[] = []
  const gains: {
    gain: { setValueAtTime: Mock; exponentialRampToValueAtTime: Mock; value: number }
    disconnect: Mock
  }[] = []
  const oscs: { onended: (() => void) | null; disconnect: Mock }[] = []
  const sources: { onended: (() => void) | null; disconnect: Mock }[] = []

  const ctx = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running'
    }),
    createGain: vi.fn(() => {
      const g = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          value: 1,
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(g)
      return g
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn((when: number) => {
          started.push({ freq: osc.frequency.value, type: osc.type, when })
        }),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }
      oscs.push(osc)
      return osc
    }),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn(),
        disconnect: vi.fn(),
      }
      sources.push(src)
      return src
    }),
    decodeAudioData: vi.fn(async () => ({}) as AudioBuffer),
  }
  return { ctx, started, gains, oscs, sources }
}

function okFetch() {
  return vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch
}

describe('오디오 엔진', () => {
  let mock: ReturnType<typeof mockAudioContext>
  const factory = () => mock.ctx as unknown as AudioContext

  beforeEach(() => {
    mock = mockAudioContext()
  })

  describe('컨텍스트 수명주기', () => {
    it('엔진 생성만으로는 AudioContext를 만들지 않는다', () => {
      const spy = vi.fn(factory)
      createAudioEngine({ contextFactory: spy })
      expect(spy).not.toHaveBeenCalled()
    })

    it('첫 사용자 제스처에서 resume한다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalled()
      expect(mock.ctx.state).toBe('running')
    })

    it('unlock을 여러 번 호출해도 AudioContext는 하나만 만든다', async () => {
      const spy = vi.fn(factory)
      const engine = createAudioEngine({ contextFactory: spy })
      await engine.unlock()
      await engine.unlock()
      await engine.unlock()
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('iOS 무음 스위치 대응: unlock 시 무음 오디오를 1회 재생한다', async () => {
      const silent = vi.fn(async () => {})
      const engine = createAudioEngine({ contextFactory: factory, playSilentAudio: silent })
      await engine.unlock()
      await engine.unlock()
      expect(silent).toHaveBeenCalledTimes(1)
    })

    it('무음 오디오 재생이 실패해도 resume은 진행한다', async () => {
      const engine = createAudioEngine({
        contextFactory: factory,
        playSilentAudio: async () => {
          throw new Error('NotAllowedError')
        },
      })
      await expect(engine.unlock()).resolves.toBeUndefined()
      expect(mock.ctx.resume).toHaveBeenCalled()
    })

    it('unlock이 실패하면 다음 제스처에서 다시 시도할 수 있다 (프로미스 오염 방지)', async () => {
      let attempt = 0
      const engine = createAudioEngine({
        contextFactory: () => {
          attempt += 1
          if (attempt === 1) throw new Error('AudioContext 생성 실패')
          return mock.ctx as unknown as AudioContext
        },
      })
      await expect(engine.unlock()).rejects.toThrow('AudioContext 생성 실패')
      // 실패가 영구 고정되면 앱이 세션 내내 무음이 된다
      await expect(engine.unlock()).resolves.toBeUndefined()
      expect(mock.ctx.resume).toHaveBeenCalled()
    })
  })

  describe('발음', () => {
    it('unlock 직후 동기 호출한 play도 소리가 난다 (첫 터치 무음 회귀 방지)', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      // FreePlay 와 동일한 순서: unlock 을 await 하지 않고 곧바로 play
      void engine.unlock()
      engine.play('C4')
      expect(mock.started).toHaveLength(1)
      expect(mock.started[0].freq).toBeCloseTo(NOTE_FREQ.C4, 3)
    })

    it('샘플이 없으면 triangle 오실레이터를 정확한 주파수로 울린다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      engine.play('E4')
      expect(mock.started).toHaveLength(1)
      expect(mock.started[0].type).toBe('triangle')
      expect(mock.started[0].freq).toBeCloseTo(NOTE_FREQ.E4, 3)
    })

    it('합성음은 0.8초 exponential 감쇠를 건다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      engine.play('C4')
      const gain = mock.gains.at(-1)!
      expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(
        expect.any(Number),
        0.8,
      )
    })

    it('컨텍스트가 아직 없으면 예외 없이 무음 처리한다', () => {
      const engine = createAudioEngine({ contextFactory: factory })
      expect(() => engine.play('C4')).not.toThrow()
      expect(mock.started).toHaveLength(0)
    })

    it('동시에 여러 음을 울릴 수 있다 (두 손가락 동시 터치)', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      engine.play('C4')
      engine.play('G4')
      expect(mock.started).toHaveLength(2)
      expect(mock.started[0].freq).toBeCloseTo(NOTE_FREQ.C4, 3)
      expect(mock.started[1].freq).toBeCloseTo(NOTE_FREQ.G4, 3)
    })

    it('동시 발음 클리핑을 막는 마스터 게인을 1개만 만든다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      const beforeNotes = mock.gains.length
      expect(beforeNotes).toBe(1) // 마스터 게인
      expect(mock.gains[0].gain.value).toBeLessThan(1)
      engine.play('C4')
      engine.play('D4')
      // 음별 게인 2개만 추가 — 마스터는 재생성되지 않는다
      expect(mock.gains).toHaveLength(beforeNotes + 2)
    })

    it('발음이 끝나면 노드를 끊어 그래프 누수를 막는다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      engine.play('C4')
      const osc = mock.oscs.at(-1)!
      const gain = mock.gains.at(-1)!
      expect(osc.onended).toBeTypeOf('function')
      osc.onended!()
      expect(osc.disconnect).toHaveBeenCalled()
      expect(gain.disconnect).toHaveBeenCalled()
    })
  })

  describe('샘플 로드', () => {
    it('unlock 전에 호출해도 샘플을 로드한다 (앱 시작 시 프리로드)', async () => {
      const fetchImpl = okFetch()
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await engine.loadSamples()
      expect(fetchImpl).toHaveBeenCalledTimes(7)
      expect(mock.ctx.decodeAudioData).toHaveBeenCalledTimes(7)
    })

    it('로드에 성공하면 합성음 대신 버퍼를 재생한다', async () => {
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl: okFetch() })
      await engine.loadSamples()
      await engine.unlock()
      engine.play('C4')
      expect(mock.ctx.createBufferSource).toHaveBeenCalledTimes(1)
      expect(mock.started).toHaveLength(0)
    })

    it('버퍼 재생이 끝나면 노드를 끊는다', async () => {
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl: okFetch() })
      await engine.loadSamples()
      await engine.unlock()
      engine.play('C4')
      const src = mock.sources.at(-1)!
      expect(src.onended).toBeTypeOf('function')
      src.onended!()
      expect(src.disconnect).toHaveBeenCalled()
    })

    it('mp3가 없으면 ogg를 시도한다', async () => {
      const urls: string[] = []
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url)
        return url.endsWith('.ogg')
          ? { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
          : { ok: false }
      }) as unknown as typeof fetch

      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await engine.loadSamples()
      expect(urls.filter((u) => u.endsWith('.mp3'))).toHaveLength(7)
      expect(urls.filter((u) => u.endsWith('.ogg'))).toHaveLength(7)
      expect(mock.ctx.decodeAudioData).toHaveBeenCalledTimes(7)
    })

    it('모든 포맷이 실패하면 조용히 합성음 폴백을 유지한다', async () => {
      const fetchImpl = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await expect(engine.loadSamples()).resolves.toBeUndefined()
      await engine.unlock()
      engine.play('C4')
      expect(mock.started).toHaveLength(1)
      expect(mock.started[0].type).toBe('triangle')
    })

    it('한 음의 로드 실패가 다른 음까지 합성음으로 떨어뜨리지 않는다', async () => {
      const fetchImpl = vi.fn(async (url: string) =>
        url.includes('C4') ? { ok: false } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) },
      ) as unknown as typeof fetch

      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await engine.loadSamples()
      await engine.unlock()
      engine.play('C4') // 실패한 음 → 합성음
      engine.play('D4') // 성공한 음 → 버퍼
      expect(mock.started).toHaveLength(1)
      expect(mock.ctx.createBufferSource).toHaveBeenCalledTimes(1)
    })

    it('네트워크 예외도 조용히 흡수한다', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await expect(engine.loadSamples()).resolves.toBeUndefined()
    })
  })
})
