import { NOTES, SOLFEGE, type Note } from '../types'

export type Verdict = 'correct' | 'wrong'

export interface KeyFlash {
  note: Note
  verdict: Verdict
}

export interface KeyboardProps {
  /** 눌러야 할 건반 — 파란 하이라이트로 표시 */
  highlight?: Note
  /** 계이름 라벨 표시 여부 (기본 true) */
  showLabels?: boolean
  /** 정답/오답 플래시 대상. 150ms 후 해제는 호출부 책임 */
  flash?: KeyFlash
  onPress: (note: Note) => void
}

export function Keyboard({ highlight, showLabels = true, flash, onPress }: KeyboardProps) {
  return (
    <div className="keyboard">
      {NOTES.map((note) => (
        <button
          key={note}
          type="button"
          className="key"
          aria-label={SOLFEGE[note]}
          data-highlight={note === highlight ? 'true' : undefined}
          data-flash={flash?.note === note ? flash.verdict : undefined}
          // 소리 지연을 줄이려면 click(=pointerup 이후)이 아니라 pointerdown 이어야 한다.
          // 마우스·터치·펜을 pointer 이벤트 하나로 처리하므로 중복 발음도 없다.
          onPointerDown={() => onPress(note)}
        >
          {/* 라벨을 숨겨도 스크린리더용 aria-label 은 유지된다 */}
          {showLabels ? <span className="key__label">{SOLFEGE[note]}</span> : null}
        </button>
      ))}
    </div>
  )
}
