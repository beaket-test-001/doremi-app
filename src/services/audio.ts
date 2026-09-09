import { NOTE_FREQ, NOTES, type Note } from '../types'

// 합성음 폴백 파라미터 (구현 가이드 '오디오 사양')
const SYNTH_DECAY_S = 0.8
const SYNTH_PEAK_GAIN = 0.2
const SYNTH_FLOOR_GAIN = 0.0001 // exponentialRamp 는 0을 받지 못한다

// 흰건반 7개를 동시에 눌러도 합이 1을 넘지 않도록 마스터에서 눌러 준다
const MASTER_GAIN = 0.7

// resume 이 연속으로 이만큼 실패하면 재시도를 멈춘다 (성공 시 카운터 리셋)
const MAX_UNLOCK_FAILURES = 5

// 사양: "포맷: mp3 + ogg 둘 다" — 두 포맷을 다 배포하고, 브라우저가 읽을 수 있는
// 쪽을 재생 전에 골라 요청한다. 404 를 보고 폴백하면 음마다 요청이 두 배가 된다.
const SAMPLE_FORMATS = [
  { ext: 'mp3', mime: 'audio/mpeg' },
  { ext: 'ogg', mime: 'audio/ogg' },
] as const

// 0 샘플 16bit 44.1kHz mono WAV — 실제로 소리는 나지 않는다.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

/**
 * 실기기 지연 판정을 위한 계측값 (구현 가이드 '스파이크 합격 기준').
 *
 * 무엇을 재고 무엇을 못 재는지 분명히 해 둔다 —
 * - input: 브라우저가 이벤트를 만든 시각(event.timeStamp) → 핸들러 진입까지.
 *   디지타이저 샘플링·컴포지터·메인스레드 경합이 여기 들어간다. 실기기에서
 *   100ms 예산의 지배항이며, 이걸 빼고 합산하면 항상 낙관적으로 나온다
 * - dispatch: 핸들러 안에서 재생을 예약하는 데 걸린 시간. 앱이 만드는 몫
 * - output: 브라우저가 보고하는 출력까지의 지연. **iOS Safari 는 미구현**
 * - 재지 못하는 것: 오디오 콜백 이후 스피커에서 실제로 소리가 나오는 물리 구간
 */
export interface AudioStats {
  state: AudioContextState | null
  /** 브라우저가 보고하는 처리 버퍼 지연 (ms). 미지원이면 null */
  baseLatencyMs: number | null
  /** 브라우저가 보고하는 출력까지의 총 지연 (ms). iOS Safari 등 미지원은 null */
  outputLatencyMs: number | null
  /** 이벤트 생성 → 핸들러 진입 (ms). 이벤트 시각을 넘기지 않으면 null */
  lastInputMs: number | null
  maxInputMs: number | null
  /** 핸들러 진입 → 재생 예약 완료 (ms) */
  lastDispatchMs: number | null
  maxDispatchMs: number | null
  plays: number
  /** 샘플이 로드된 음 수 (0 이면 합성음으로 동작 중) */
  samplesLoaded: number
}

export interface AudioEngine {
  /** 첫 사용자 제스처에서 호출. 무음 재생으로 오디오 세션을 깨우고 resume (iOS 필수) */
  unlock(): Promise<void>
  /** 피아노 샘플 7개를 받아 디코드. 앱 시작 시 호출 가능 — unlock 을 기다리지 않는다 */
  loadSamples(): Promise<void>
  /**
   * 즉시 발음. 샘플이 있으면 버퍼, 없으면 합성음.
   * eventTimeStampMs 를 넘기면 입력 지연(이벤트 생성 → 핸들러 진입)도 기록한다.
   */
  play(note: Note, eventTimeStampMs?: number): void
  /** 지연 계측값. 실기기 QA 에서 체감이 아니라 실측으로 판정하기 위한 것 */
  stats(): AudioStats
  /** 계측값 초기화. 한 번의 이상치가 최댓값에 영구 고착되는 것을 풀어 준다 */
  resetStats(): void
}

export interface AudioEngineOptions {
  contextFactory?: (options?: AudioContextOptions) => AudioContext
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
    // 'interactive' 는 스펙 기본값이라 실효는 없지만, 이 앱이 낮은 지연을
    // 요구한다는 의도를 코드에 남겨 둔다 (나중에 기본값이 바뀌어도 안전).
    contextFactory = (o) => new AudioContext(o),
    fetchImpl = globalThis.fetch?.bind(globalThis),
    playSilentAudio = defaultPlaySilentAudio,
    canPlayType = (mime) => new Audio().canPlayType(mime),
  } = options

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let unlockPromise: Promise<void> | null = null
  let unlockInFlight = false
  let consecutiveFailures = 0
  let loadPromise: Promise<void> | null = null
  const samples = new Map<Note, AudioBuffer>()

  let plays = 0
  let lastInputMs: number | null = null
  let maxInputMs: number | null = null
  let lastDispatchMs: number | null = null
  let maxDispatchMs: number | null = null

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
      const context = contextFactory({ latencyHint: 'interactive' })
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
    // running 이면 이미 열려 있으니 캐시된 프로미스를 그대로 준다.
    // iOS 는 백그라운드 전환 시 컨텍스트를 suspended · interrupted 로 만드는데,
    // 무조건 캐시를 반환하면 복귀 후 resume 을 다시 시도하지 못해 계속 무음이 된다.
    if (unlockPromise && ctx?.state === 'running') return unlockPromise

    // 건반을 누를 때마다 unlock 이 불리므로, 아직 진행 중인 시도가 있으면 편승한다.
    // 이 가드가 없으면 자동재생이 차단된 기기에서 연타할 때마다 무음 Audio 와
    // resume 호출이 쌓인다.
    if (unlockPromise && unlockInFlight) return unlockPromise

    // resume 이 계속 실패하는 기기에서 무한히 재시도하지 않는다.
    // 성공하면 카운터를 되돌리므로 백그라운드 복귀는 몇 번이든 처리된다.
    if (consecutiveFailures >= MAX_UNLOCK_FAILURES) return Promise.resolve()

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

    unlockInFlight = true
    unlockPromise = attempt
    void attempt.then(
      () => {
        unlockInFlight = false
        // 실제로 열렸을 때만 성공으로 본다
        if (context.state === 'running') consecutiveFailures = 0
        else consecutiveFailures += 1
      },
      () => {
        unlockInFlight = false
        consecutiveFailures += 1
      },
    )
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

  function play(note: Note, eventTimeStampMs?: number): void {
    if (!ctx || !master) return // 컨텍스트가 아직 없으면 조용히 무시

    const start = performance.now()

    // event.timeStamp 는 브라우저가 이벤트를 만든 시각이고 performance.now() 와
    // 같은 시간 기준을 쓴다. 이 차이가 터치→핸들러 진입 지연이며 실기기에서
    // 100ms 예산의 지배항이다. 음수·비정상값은 버린다(합성 이벤트 등).
    if (typeof eventTimeStampMs === 'number' && eventTimeStampMs > 0) {
      const input = start - eventTimeStampMs
      if (input >= 0 && input < 10_000) {
        lastInputMs = input
        maxInputMs = Math.max(maxInputMs ?? 0, input)
      }
    }

    const buffer = samples.get(note)
    if (buffer) playSample(ctx, buffer)
    else playSynth(ctx, note)

    lastDispatchMs = performance.now() - start
    maxDispatchMs = Math.max(maxDispatchMs ?? 0, lastDispatchMs)
    plays += 1
  }

  function resetStats(): void {
    plays = 0
    lastInputMs = null
    maxInputMs = null
    lastDispatchMs = null
    maxDispatchMs = null
  }

  function toMs(seconds: number | undefined): number | null {
    return typeof seconds === 'number' ? seconds * 1000 : null
  }

  function stats(): AudioStats {
    return {
      state: ctx?.state ?? null,
      baseLatencyMs: toMs(ctx?.baseLatency),
      outputLatencyMs: toMs(ctx?.outputLatency),
      lastInputMs,
      maxInputMs,
      lastDispatchMs,
      maxDispatchMs,
      plays,
      samplesLoaded: samples.size,
    }
  }

  return { unlock, loadSamples, play, stats, resetStats }
}
