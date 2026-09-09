import { NOTE_FREQ, NOTES, type Note } from '../types'

// 합성음 폴백 파라미터 (구현 가이드 '오디오 사양')
const SYNTH_DECAY_S = 0.8
const SYNTH_PEAK_GAIN = 0.2
const SYNTH_FLOOR_GAIN = 0.0001 // exponentialRamp 는 0을 받지 못한다

// 흰건반 7개를 동시에 눌러도 합이 1을 넘지 않도록 마스터에서 눌러 준다
const MASTER_GAIN = 0.7

// 사양: "포맷: mp3 + ogg 둘 다" — 브라우저가 못 읽는 포맷은 다음 것으로 넘어간다
const SAMPLE_FORMATS = ['mp3', 'ogg'] as const

// 0 샘플 16bit 44.1kHz mono WAV — 실제로 소리는 나지 않는다.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export interface AudioEngine {
  /** 첫 사용자 제스처에서 호출. 무음 재생으로 오디오 세션을 깨우고 resume (iOS 필수) */
  unlock(): Promise<void>
  /** 피아노 샘플 7개를 받아 디코드. 앱 시작 시 호출 가능 — unlock 을 기다리지 않는다 */
  loadSamples(): Promise<void>
  /** 즉시 발음. 샘플이 있으면 버퍼, 없으면 합성음 */
  play(note: Note): void
}

export interface AudioEngineOptions {
  contextFactory?: () => AudioContext
  fetchImpl?: typeof fetch
  /** iOS 무음 스위치 해제용 무음 재생. 테스트에서 교체한다 */
  playSilentAudio?: () => Promise<void>
}

// iOS 는 <audio> 재생으로 오디오 세션이 전환되기 전까지 무음 스위치가 Web Audio 를 죽인다.
// 첫 제스처에서 무음 파일을 1회 재생해 세션을 깨운다.
async function defaultPlaySilentAudio(): Promise<void> {
  const el = new Audio(SILENT_WAV)
  el.volume = 0
  await el.play()
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const {
    contextFactory = () => new AudioContext(),
    fetchImpl = globalThis.fetch?.bind(globalThis),
    playSilentAudio = defaultPlaySilentAudio,
  } = options

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let unlockPromise: Promise<void> | null = null
  const samples = new Map<Note, AudioBuffer>()

  // AudioContext 는 제스처 밖에서 만들어도 된다 (suspended 로 시작할 뿐).
  // 제스처가 필요한 건 resume() 뿐이므로, 생성은 언제든 동기로 해 둔다 —
  // 이렇게 해야 unlock() 직후의 동기 play() 도 음을 예약할 수 있다.
  function ensureContext(): AudioContext {
    if (!ctx) {
      ctx = contextFactory()
      master = ctx.createGain()
      master.gain.value = MASTER_GAIN
      master.connect(ctx.destination)
    }
    return ctx
  }

  function unlock(): Promise<void> {
    if (unlockPromise) return unlockPromise

    const attempt = (async () => {
      const context = ensureContext()
      // 순서 주의: 무음 재생으로 세션을 전환한 뒤 resume 한다 (구현 가이드)
      await playSilentAudio().catch(() => {
        // 자동재생 차단 등은 무시 — 이걸로 resume 을 막으면 정상 기기까지 무음이 된다
      })
      if (context.state === 'suspended') await context.resume()
    })()

    unlockPromise = attempt
    // 실패를 프로미스에 영구 고정하면 세션 내내 복구 불가능한 무음이 된다.
    // 다음 제스처에서 다시 시도할 수 있게 비워 둔다.
    // (?? = 로 대입하면 IIFE 가 먼저 동기 실행되므로 초기화가 덮어써진다)
    attempt.catch(() => {
      if (unlockPromise === attempt) unlockPromise = null
    })

    return attempt
  }

  async function fetchSample(note: Note): Promise<ArrayBuffer | null> {
    if (!fetchImpl) return null
    for (const format of SAMPLE_FORMATS) {
      try {
        const res = await fetchImpl(`${import.meta.env.BASE_URL}sounds/${note}.${format}`)
        if (res.ok) return await res.arrayBuffer()
      } catch {
        // 네트워크 예외도 다음 포맷 시도로 넘긴다
      }
    }
    return null
  }

  async function loadSamples(): Promise<void> {
    const context = ensureContext()
    // 한 음이라도 실패하면 그 음만 합성음으로 떨어진다 (전체 실패로 만들지 않는다).
    // 로드 실패는 사용자에게 표시하지 않는다 (화면 상세 사양 엣지 케이스).
    await Promise.all(
      NOTES.map(async (note) => {
        const encoded = await fetchSample(note)
        if (!encoded) return
        try {
          samples.set(note, await context.decodeAudioData(encoded))
        } catch {
          // 디코드 실패도 합성음 폴백
        }
      }),
    )
  }

  function playSample(context: AudioContext, buffer: AudioBuffer): void {
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(master!)
    source.onended = () => source.disconnect()
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
    gain.connect(master!)
    // 끊지 않으면 연타할수록 죽은 노드가 그래프에 쌓인다
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
    osc.start(now)
    osc.stop(now + SYNTH_DECAY_S)
  }

  function play(note: Note): void {
    if (!ctx) return // 컨텍스트가 아직 없으면 조용히 무시
    const buffer = samples.get(note)
    if (buffer) playSample(ctx, buffer)
    else playSynth(ctx, note)
  }

  return { unlock, loadSamples, play }
}
