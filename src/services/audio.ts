import { NOTE_FREQ, NOTES, type Note } from '../types'

// 합성음 폴백 파라미터 (구현 가이드 '오디오 사양')
const SYNTH_DECAY_S = 0.8
const SYNTH_PEAK_GAIN = 0.3
const SYNTH_FLOOR_GAIN = 0.0001 // exponentialRamp는 0을 받지 못한다

export interface AudioEngine {
  /** 첫 사용자 제스처에서 호출. AudioContext 생성 + resume (iOS 필수) */
  unlock(): Promise<void>
  /** 피아노 샘플 7개를 미리 받아 디코드. 실패하면 조용히 합성음 폴백을 유지 */
  loadSamples(): Promise<void>
  /** 즉시 발음. unlock 전이면 아무 일도 하지 않는다 */
  play(note: Note): void
}

export interface AudioEngineOptions {
  contextFactory?: () => AudioContext
  fetchImpl?: typeof fetch
  /** 샘플 URL 생성기. 기본은 sounds/<note>.mp3 */
  sampleUrl?: (note: Note) => string
  /** iOS 무음 스위치 해제용 무음 재생. 테스트에서 교체한다 */
  playSilentAudio?: () => Promise<void>
}

function defaultContextFactory(): AudioContext {
  return new AudioContext()
}

// 0 샘플 16bit 44.1kHz mono WAV — 실제로 소리는 나지 않는다.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

// iOS는 <audio> 재생으로 오디오 세션이 전환되기 전까지 무음 스위치가 Web Audio를 죽인다.
// 첫 제스처에서 무음 파일을 1회 재생해 세션을 깨운다.
async function defaultPlaySilentAudio(): Promise<void> {
  const el = new Audio(SILENT_WAV)
  el.volume = 0
  await el.play()
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const {
    contextFactory = defaultContextFactory,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    sampleUrl = (note) => `${import.meta.env.BASE_URL}sounds/${note}.mp3`,
    playSilentAudio = defaultPlaySilentAudio,
  } = options

  // AudioContext는 사용자 제스처 안에서 만들어야 iOS가 재생을 허용한다.
  // 따라서 모듈 로드 시점이 아니라 unlock()에서 처음 만든다.
  let ctx: AudioContext | null = null
  let unlocking: Promise<void> | null = null
  const samples = new Map<Note, AudioBuffer>()

  async function unlock(): Promise<void> {
    // 제스처마다 unlock이 불릴 수 있으므로 최초 1회만 실제로 수행한다
    unlocking ??= (async () => {
      // 무음 재생 실패(자동재생 차단 등)는 무시한다 — resume 자체를 막아선 안 된다
      await playSilentAudio().catch(() => {})
      ctx = contextFactory()
      if (ctx.state === 'suspended') await ctx.resume()
    })()
    return unlocking
  }

  async function loadSamples(): Promise<void> {
    if (!ctx || !fetchImpl) return
    const context = ctx
    // 한 음이라도 실패하면 그 음만 합성음으로 떨어진다 (전체 실패로 만들지 않는다)
    await Promise.all(
      NOTES.map(async (note) => {
        try {
          const res = await fetchImpl(sampleUrl(note))
          if (!res.ok) return
          samples.set(note, await context.decodeAudioData(await res.arrayBuffer()))
        } catch {
          // 샘플 로드 실패는 사용자에게 표시하지 않는다 (화면 상세 사양 엣지 케이스)
        }
      }),
    )
  }

  function playSample(context: AudioContext, buffer: AudioBuffer): void {
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
  }

  function playSynth(context: AudioContext, note: Note): void {
    const now = context.currentTime
    const osc = context.createOscillator()
    const gain = context.createGain()

    osc.type = 'triangle'
    osc.frequency.value = NOTE_FREQ[note]
    gain.gain.setValueAtTime(SYNTH_PEAK_GAIN, now)
    gain.gain.exponentialRampToValueAtTime(SYNTH_FLOOR_GAIN, now + SYNTH_DECAY_S)

    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(now)
    osc.stop(now + SYNTH_DECAY_S)
  }

  function play(note: Note): void {
    if (!ctx) return // unlock 전 — 조용히 무시
    const buffer = samples.get(note)
    if (buffer) playSample(ctx, buffer)
    else playSynth(ctx, note)
  }

  return { unlock, loadSamples, play }
}
