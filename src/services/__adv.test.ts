import { describe, expect, it, vi } from 'vitest'
import { createAudioEngine } from './audio'

/** resume 이 즉시 끝나지 않는(= 실제 브라우저와 같은) 컨텍스트 목 */
function slowCtx() {
  const releases: (() => void)[] = []
  const ctx = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(
      () =>
        new Promise<void>((res) => {
          releases.push(() => {
            ctx.state = 'running'
            res()
          })
        }),
    ),
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(),
    createBufferSource: vi.fn(),
    decodeAudioData: vi.fn(),
  }
  return { ctx, flush: () => releases.forEach((r) => r()) }
}

describe('적대적: unlock 재진입', () => {
  it('첫 unlock 이 진행 중일 때 두 번째 unlock 은 무음 재생과 resume 을 중복 실행한다', async () => {
    const { ctx, flush } = slowCtx()
    const silent = vi.fn(async () => {})
    const engine = createAudioEngine({
      contextFactory: () => ctx as unknown as AudioContext,
      playSilentAudio: silent,
    })

    const p1 = engine.unlock() // 첫 터치
    const p2 = engine.unlock() // 두 번째 터치 (아직 suspended)
    const p3 = engine.unlock() // 세 번째 터치

    expect(silent).toHaveBeenCalledTimes(3) // ← 1 이어야 하는데 3
    expect(ctx.resume).toHaveBeenCalledTimes(3)
    expect(p1).not.toBe(p2)

    flush()
    await Promise.all([p1, p2, p3])
  })

  it('resume 이 계속 실패하면 누를 때마다 무음 재생이 무한 반복된다', async () => {
    const ctx = {
      state: 'suspended' as AudioContextState,
      currentTime: 0,
      destination: {},
      // 자동재생 정책상 제스처가 무효 판정되는 경우
      resume: vi.fn(async () => {
        throw new Error('NotAllowedError')
      }),
      createGain: vi.fn(() => ({
        gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createOscillator: vi.fn(),
      createBufferSource: vi.fn(),
      decodeAudioData: vi.fn(),
    }
    const silent = vi.fn(async () => {})
    const engine = createAudioEngine({
      contextFactory: () => ctx as unknown as AudioContext,
      playSilentAudio: silent,
    })
    for (let i = 0; i < 20; i++) await engine.unlock().catch(() => {})
    expect(silent).toHaveBeenCalledTimes(20)
    expect(ctx.resume).toHaveBeenCalledTimes(40) // 시도당 2회 (초기 + 재확인)
  })
})
