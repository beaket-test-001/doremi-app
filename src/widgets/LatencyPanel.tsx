import { useEffect, useRef, useState } from 'react'
import { verdictOf } from '../core/diagnostics'
import { NOTES } from '../types'
import type { AudioEngine } from '../services/audio'

const REFRESH_MS = 1000

function fmt(ms: number | null): string {
  return ms === null ? '—' : `${ms.toFixed(1)}ms`
}

/**
 * 실기기 지연을 실측으로 보기 위한 QA 전용 오버레이 (`?diag=1`).
 *
 * 구현 가이드의 스파이크 합격 기준이 요구한 화면이다. 다만 브라우저에서
 * 터치→소리 전 구간을 잴 방법은 없으므로, **재는 구간과 못 재는 구간을
 * 나눠서 보여주고 합격을 단정하지 않는다.**
 */
export function LatencyPanel({ audio }: { audio: AudioEngine }) {
  const [snapshot, setSnapshot] = useState(() => audio.stats())
  const [closed, setClosed] = useState(false)
  const seen = useRef('')

  useEffect(() => {
    if (closed) return
    const timer = setInterval(() => {
      const next = audio.stats()
      // 값이 그대로면 리렌더하지 않는다 — 1Hz setState 가 측정 대상을 흔든다
      const key = `${next.plays}|${next.lastInputMs}|${next.lastDispatchMs}|${next.state}`
      if (key === seen.current) return
      seen.current = key
      setSnapshot(next)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [audio, closed])

  if (closed) return null

  const verdict = verdictOf(snapshot)

  return (
    <section className="diag" data-level={verdict.level} aria-label="오디오 지연 진단 (QA 전용)">
      <div className="diag__head">
        <strong>오디오 지연 진단</strong>
        <button
          type="button"
          className="diag__btn"
          onClick={() => {
            audio.resetStats()
            seen.current = ''
            setSnapshot(audio.stats())
          }}
        >
          초기화
        </button>
        <button type="button" className="diag__btn" onClick={() => setClosed(true)}>
          닫기
        </button>
      </div>

      <span data-testid="verdict">{verdict.text}</span>
      <span>
        입력(터치→핸들러): {fmt(snapshot.lastInputMs)} · 최대 {fmt(snapshot.maxInputMs)}
      </span>
      <span>
        예약(핸들러→재생): {fmt(snapshot.lastDispatchMs)} · 최대 {fmt(snapshot.maxDispatchMs)}
      </span>
      <span>
        브라우저 보고: base {fmt(snapshot.baseLatencyMs)} · output {fmt(snapshot.outputLatencyMs)}
      </span>
      <span data-testid="plays">
        연주 {snapshot.plays}회 · 컨텍스트 {snapshot.state ?? '미생성'}
      </span>
      <span>
        {snapshot.samplesLoaded > 0
          ? `샘플 ${snapshot.samplesLoaded}/${NOTES.length} 로드`
          : '샘플 없음 — 합성음으로 동작 중'}
      </span>
      <span className="diag__note">
        물리 출력 구간은 브라우저가 알려주지 않습니다. 하한이 목표를 넘으면 확정 실패이고,
        밑이라도 합격은 아닙니다.
      </span>
    </section>
  )
}
