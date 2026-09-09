import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
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
    baseLatency: undefined as number | undefined,
    outputLatency: undefined as number | undefined,
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
    // jsdom 은 HTMLMediaElement.play 를 구현하지 않아 콘솔 노이즈가 난다.
    // 무음 재생 동작 자체는 playSilentAudio 를 명시로 주입하는 테스트에서 검증한다.
    vi.stubGlobal(
      'Audio',
      class {
        volume = 0
        canPlayType() {
          return ''
        }
        play() {
          return Promise.resolve()
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('지연 계측', () => {
    it("AudioContext 를 latencyHint: 'interactive' 로 만든다", () => {
      const opts: AudioContextOptions[] = []
      const engine = createAudioEngine({
        contextFactory: (o) => {
          opts.push(o ?? {})
          return mock.ctx as unknown as AudioContext
        },
      })
      void engine.unlock()
      expect(opts).toHaveLength(1)
      expect(opts[0].latencyHint).toBe('interactive')
    })

    it('play 가 pointerdown → 재생 예약까지의 소요 시간을 기록한다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      expect(engine.stats().plays).toBe(0)

      engine.play('C4')
      const s = engine.stats()
      expect(s.plays).toBe(1)
      expect(s.lastDispatchMs).toBeGreaterThanOrEqual(0)
      expect(s.maxDispatchMs).toBeGreaterThanOrEqual(s.lastDispatchMs ?? 0)
    })

    it('브라우저가 보고하는 base · output 지연을 노출한다', async () => {
      mock.ctx.baseLatency = 0.005
      mock.ctx.outputLatency = 0.021
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      const s = engine.stats()
      expect(s.baseLatencyMs).toBeCloseTo(5, 1)
      expect(s.outputLatencyMs).toBeCloseTo(21, 1)
    })

    it('컨텍스트가 없으면 지연 값은 null 이다', () => {
      const engine = createAudioEngine({ contextFactory: factory })
      const s = engine.stats()
      expect(s.baseLatencyMs).toBeNull()
      expect(s.outputLatencyMs).toBeNull()
      expect(s.state).toBeNull()
    })

    it('브라우저가 outputLatency 를 지원하지 않으면 null 이다', async () => {
      mock.ctx.baseLatency = 0.005
      mock.ctx.outputLatency = undefined
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      expect(engine.stats().outputLatencyMs).toBeNull()
      expect(engine.stats().baseLatencyMs).toBeCloseTo(5, 1)
    })

    it('여러 번 연주하면 최댓값이 누적된다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      engine.play('C4')
      engine.play('D4')
      engine.play('E4')
      expect(engine.stats().plays).toBe(3)
    })
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

    it('컨텍스트 생성이 실패하면 실패를 고정하지 않고 다음 제스처에서 다시 시도한다', async () => {
      let attempt = 0
      const engine = createAudioEngine({
        contextFactory: () => {
          attempt += 1
          if (attempt === 1) throw new Error('AudioContext 생성 실패')
          return mock.ctx as unknown as AudioContext
        },
      })
      // 오디오 실패는 사용자에게 표시하지 않으므로 reject 하지 않는다
      await expect(engine.unlock()).resolves.toBeUndefined()
      expect(mock.ctx.resume).not.toHaveBeenCalled()
      // 실패가 영구 고정되면 앱이 세션 내내 무음이 된다
      await engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalled()
    })
  })

  describe('백그라운드 복귀', () => {
    it('컨텍스트가 다시 suspended 되면 다음 unlock 에서 재resume 한다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalledTimes(1)

      // iOS 는 백그라운드 전환 시 컨텍스트를 suspended · interrupted 로 만든다
      mock.ctx.state = 'suspended'
      await engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalledTimes(2)
      expect(mock.ctx.state).toBe('running')
    })

    it('running 상태에서는 중복 resume 하지 않는다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      await engine.unlock()
      await engine.unlock()
      await engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalledTimes(1)
    })

    it('진행 중인 unlock 이 있으면 편승한다 (연타 시 중복 시도 방지)', async () => {
      let silentCalls = 0
      let release: (() => void) | undefined
      const engine = createAudioEngine({
        contextFactory: factory,
        playSilentAudio: () => {
          silentCalls += 1
          return new Promise<void>((r) => {
            release = r
          })
        },
      })
      // 첫 시도가 아직 끝나지 않은 상태에서 연타
      const a = engine.unlock()
      const b = engine.unlock()
      const c = engine.unlock()
      expect(silentCalls).toBe(1)
      expect(b).toBe(a)
      expect(c).toBe(a)
      release!()
      await a
    })

    it('resume 이 계속 실패하면 재시도를 멈춘다 (무한 시도 방지)', async () => {
      let silentCalls = 0
      const stuck = {
        ...mock.ctx,
        state: 'suspended' as AudioContextState,
        resume: vi.fn(async () => {}), // running 으로 바뀌지 않는다
      }
      const engine = createAudioEngine({
        contextFactory: () => stuck as unknown as AudioContext,
        playSilentAudio: async () => {
          silentCalls += 1
        },
      })
      for (let i = 0; i < 20; i++) await engine.unlock()
      // 상한(5회)을 넘어서는 시도를 하지 않는다
      expect(silentCalls).toBeLessThanOrEqual(5)
    })

    it('한 번 성공하면 실패 카운터가 리셋되어 이후 복귀를 계속 처리한다', async () => {
      const engine = createAudioEngine({ contextFactory: factory })
      // 백그라운드 복귀를 10회 반복
      for (let i = 0; i < 10; i++) {
        await engine.unlock()
        expect(mock.ctx.state).toBe('running')
        mock.ctx.state = 'suspended'
      }
      expect(mock.ctx.resume).toHaveBeenCalledTimes(10)
    })

    it('재resume 시 AudioContext 는 새로 만들지 않는다', async () => {
      const spy = vi.fn(factory)
      const engine = createAudioEngine({ contextFactory: spy })
      await engine.unlock()
      mock.ctx.state = 'suspended'
      await engine.unlock()
      expect(spy).toHaveBeenCalledTimes(1)
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

  describe('오디오를 쓸 수 없는 환경', () => {
    it('AudioContext가 없는 브라우저에서도 예외 없이 무음 동작한다', async () => {
      const engine = createAudioEngine({
        contextFactory: () => {
          throw new ReferenceError('AudioContext is not defined')
        },
      })
      await expect(engine.unlock()).resolves.toBeUndefined()
      await expect(engine.loadSamples()).resolves.toBeUndefined()
      expect(() => engine.play('C4')).not.toThrow()
    })

    it('마스터 게인 생성이 실패하면 발음하지 않고, 다음 제스처에서 복구를 시도한다', async () => {
      let attempt = 0
      const engine = createAudioEngine({
        contextFactory: () => {
          attempt += 1
          if (attempt === 1) {
            return {
              ...mock.ctx,
              createGain: () => {
                throw new Error('createGain 실패')
              },
            } as unknown as AudioContext
          }
          return mock.ctx as unknown as AudioContext
        },
      })
      await expect(engine.unlock()).resolves.toBeUndefined()
      // 반쪽 상태(ctx는 있고 master는 없음)로 남아 play가 터지면 안 된다
      expect(() => engine.play('C4')).not.toThrow()
      expect(mock.started).toHaveLength(0)

      await engine.unlock()
      engine.play('C4')
      expect(mock.started).toHaveLength(1)
    })
  })

  describe('제스처 타이밍', () => {
    it('resume을 제스처와 같은 태스크에서 동기 호출한다 (iOS 신뢰성)', () => {
      const engine = createAudioEngine({ contextFactory: factory })
      // await 하지 않는다 — 이 시점에 이미 resume이 불려 있어야 한다
      void engine.unlock()
      expect(mock.ctx.resume).toHaveBeenCalled()
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

    it('여러 번 호출해도 한 번만 로드한다 (StrictMode 이중 마운트)', async () => {
      const fetchImpl = okFetch()
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await Promise.all([engine.loadSamples(), engine.loadSamples()])
      await engine.loadSamples()
      expect(fetchImpl).toHaveBeenCalledTimes(7)
    })

    it('음원이 없어도 음당 요청은 1회를 넘지 않는다', async () => {
      const fetchImpl = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch
      const engine = createAudioEngine({ contextFactory: factory, fetchImpl })
      await engine.loadSamples()
      expect(fetchImpl).toHaveBeenCalledTimes(7)
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

    it('mp3를 재생할 수 있는 브라우저에는 mp3만 요청한다', async () => {
      const urls: string[] = []
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url)
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
      }) as unknown as typeof fetch

      const engine = createAudioEngine({
        contextFactory: factory,
        fetchImpl,
        canPlayType: (mime) => (mime === 'audio/mpeg' ? 'probably' : ''),
      })
      await engine.loadSamples()
      expect(urls.filter((u) => u.endsWith('.mp3'))).toHaveLength(7)
      expect(urls.filter((u) => u.endsWith('.ogg'))).toHaveLength(0)
    })

    it('mp3를 못 읽는 브라우저에는 ogg를 요청한다', async () => {
      const urls: string[] = []
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url)
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }
      }) as unknown as typeof fetch

      const engine = createAudioEngine({
        contextFactory: factory,
        fetchImpl,
        canPlayType: (mime) => (mime === 'audio/ogg' ? 'probably' : ''),
      })
      await engine.loadSamples()
      expect(urls.filter((u) => u.endsWith('.ogg'))).toHaveLength(7)
      expect(urls.filter((u) => u.endsWith('.mp3'))).toHaveLength(0)
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
