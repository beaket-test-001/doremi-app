import { useEffect, useState } from 'react'
import { TARGET_MS } from '../core/diagnostics'
import { NOTES } from '../types'
import type { AudioEngine } from '../services/audio'

const REFRESH_MS = 1000

function fmt(ms: number | null): string {
  return ms === null ? '—' : `${ms.toFixed(1)}ms`
}

/**
 * 실기기 지연을 실측으로 판정하기 위한 오버레이.
 *
 * 구현 가이드의 스파이크 합격 기준이 요구한 화면이다 —
 * "pointerdown → 재생 시작의 차이를 표시하고 실기기에서 100ms 이하인지 확인".
 * 스파이크가 실시되지 않아 9/11 QA 에 들고 갈 숫자가 없어서 뒤늦게 만들었다.
 */
export function LatencyPanel({ audio }: { audio: AudioEngine }) {
  const [snapshot, setSnapshot] = useState(() => audio.stats())

  useEffect(() => {
    const timer = setInterval(() => setSnapshot(audio.stats()), REFRESH_MS)
    return () => clearInterval(timer)
  }, [audio])

  const { state, baseLatencyMs, outputLatencyMs, lastDispatchMs, maxDispatchMs, plays } = snapshot

  // outputLatency 는 base 를 포함한 출력까지의 총 지연이다. 여기에 앱이 만드는
  // 최악 처리 시간을 더해 터치→소리를 추정한다.
  const estimated = outputLatencyMs === null ? null : outputLatencyMs + (maxDispatchMs ?? 0)
  const verdict =
    estimated === null
      ? '측정 불가 (이 브라우저는 outputLatency 미지원)'
      : estimated <= TARGET_MS
        ? `통과 — 추정 ${estimated.toFixed(1)}ms ≤ ${TARGET_MS}ms`
        : `초과 — 추정 ${estimated.toFixed(1)}ms > ${TARGET_MS}ms`

  return (
    <div className="diag" aria-hidden="true">
      <strong>오디오 지연 진단</strong>
      <span data-testid="verdict">{verdict}</span>
      <span>
        브라우저 보고: base {fmt(baseLatencyMs)} · output {fmt(outputLatencyMs)}
      </span>
      <span>
        앱 처리: dispatch {fmt(lastDispatchMs)} · max {fmt(maxDispatchMs)}
      </span>
      <span data-testid="plays">
        연주 {plays}회 · 컨텍스트 {state ?? '미생성'}
      </span>
      <span>
        {snapshot.samplesLoaded > 0
          ? `샘플 ${snapshot.samplesLoaded}/${NOTES.length} 로드`
          : `샘플 없음 — 합성음으로 동작 중`}
      </span>
    </div>
  )
}
