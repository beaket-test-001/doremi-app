import { NOTE_FREQ, NOTES, type Note } from '../types'

// 합성음 폴백 파라미터 (구현 가이드 '오디오 사양')
const SYNTH_DECAY_S = 0.8
const SYNTH_PEAK_GAIN = 0.2
const SYNTH_FLOOR_GAIN = 0.0001 // exponentialRamp 는 0을 받지 못한다

// 흰건반 7개를 동시에 눌러도 합이 1을 넘지 않도록 마스터에서 눌러 준다
const MASTER_GAIN = 0.7

// 사양: "포맷: mp3 + ogg 둘 다" — 두 포맷을 다 배포하고, 브라우저가 읽을 수 있는
// 쪽을 재생 전에 골라 요청한다. 404 를 보고 폴백하면 음마다 요청이 두 배가 된다.
const SAMPLE_FORMATS = [
  { ext: 'mp3', mime: 'audio/mpeg' },
  { ext: 'ogg', mime: 'audio/ogg' },
] as const

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
  /** 포맷 지원 판정. 기본은 HTMLAudioElement.canPlayType */
  canPlayType?: (mime: string) => string
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
    canPlayType = (mime) => new Audio().canPlayType(mime),
  } = options

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let unlockPromise: Promise<void> | null = null
  let loadPromise: Promise<void> | null = null
  const samples = new Map<Note, AudioBuffer>()

  // AudioContext 는 제스처 밖에서 만들어도 된다 (suspended 로 시작할 뿐).
  // 제스처가 필요한 건 resume() 뿐이므로 생성은 동기로 끝낸다 —
  // 이렇게 해야 unlock() 직후의 동기 play() 도 음을 예약할 수 있다.
  //
  // ctx 와 master 는 한 번에 대입한다. 따로 대입하면 createGain 이 실패했을 때
  // ctx 만 남은 반쪽 상태가 되어 play() 가 null master 를 참조한다.
  // 실패 시 아무것도 대입하지 않으므로 다음 호출에서 다시 시도할 수 있다.
  function ensureContext(): AudioContext | null {
    if (ctx) return ctx
    try {
      const context = contextFactory()
      const gain = context.createGain()
      gain.gain.value = MASTER_GAIN
      gain.connect(context.destination)
      ctx = context
      master = gain
      return ctx
    } catch {
      // Web Audio 미지원 브라우저 등 — 앱은 무음으로 계속 동작해야 한다
      return null
    }
  }

  function unlock(): Promise<void> {
    if (unlockPromise) return unlockPromise

    const context = ensureContext()
    if (!context) return Promise.resolve() // 오디오 없이도 화면은 써야 한다

    // 둘 다 제스처와 같은 태스크에서 시작해야 iOS 가 허용한다.
    // 무음 재생으로 오디오 세션을 전환하고(무음 스위치 대응), resume 으로 컨텍스트를 깨운다.
    const sessionSwitch = playSilentAudio().catch(() => {
      // 자동재생 차단 등은 무시 — 이걸로 resume 을 막으면 정상 기기까지 무음이 된다
    })
    const resumed = context.resume().catch(() => {})

    const attempt = (async () => {
      await sessionSwitch
      await resumed
      // 세션 전환 전에 건 resume 이 무시됐을 수 있으므로 한 번 더 확인한다
      if (context.state === 'suspended') await context.resume()
    })()

    unlockPromise = attempt
    // 실패를 프로미스에 영구 고정하면 세션 내내 복구 불가능한 무음이 된다.
    // (?? = 로 대입하면 IIFE 가 먼저 동기 실행되므로 초기화가 덮어써진다)
    attempt.catch(() => {
      if (unlockPromise === attempt) unlockPromise = null
    })

    return attempt
  }

  // 재생 가능한 포맷을 한 번만 판정한다. 판정이 애매하면 사실상 보편적인 mp3 로 간다.
  function pickFormat(): string {
    for (const { ext, mime } of SAMPLE_FORMATS) {
      try {
        if (canPlayType(mime)) return ext
      } catch {
        break
      }
    }
    return SAMPLE_FORMATS[0].ext
  }

  async function fetchSample(note: Note, format: string): Promise<ArrayBuffer | null> {
    if (!fetchImpl) return null
    try {
      const res = await fetchImpl(`${import.meta.env.BASE_URL}sounds/${note}.${format}`)
      if (res.ok) return await res.arrayBuffer()
    } catch {
      // 네트워크 예외도 합성음 폴백으로 흘린다
    }
    return null
  }

  async function decodeInto(context: AudioContext, note: Note, encoded: ArrayBuffer) {
    try {
      samples.set(note, await context.decodeAudioData(encoded))
    } catch {
      // 디코드 실패도 합성음 폴백
    }
  }

  // 로드 실패는 사용자에게 표시하지 않는다 (화면 상세 사양 엣지 케이스).
  // 절대 reject 하지 않으므로 호출부에서 fire-and-forget 해도 안전하다.
  function loadSamples(): Promise<void> {
    if (loadPromise) return loadPromise // StrictMode 이중 마운트 등에서 재요청 방지

    loadPromise = (async () => {
      const context = ensureContext()
      if (!context) return

      // 한 음의 실패가 다른 음까지 합성음으로 떨어뜨리지 않게 음별로 개별 처리한다
      const format = pickFormat()
      await Promise.all(
        NOTES.map(async (note) => {
          const encoded = await fetchSample(note, format)
          if (encoded) await decodeInto(context, note, encoded)
        }),
      )
    })()

    return loadPromise
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
    if (!ctx || !master) return // 컨텍스트가 아직 없으면 조용히 무시
    const buffer = samples.get(note)
    if (buffer) playSample(ctx, buffer)
    else playSynth(ctx, note)
  }

  return { unlock, loadSamples, play }
}
