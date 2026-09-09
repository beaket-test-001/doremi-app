import { NOTES, SOLFEGE, type Note } from '../types'

export interface KeyboardProps {
  /** 눌러야 할 건반 — 파란 하이라이트로 표시 */
  highlight?: Note
  /** 계이름 라벨 표시 여부 (기본 true) */
  showLabels?: boolean
  onPress: (note: Note) => void
}

export function Keyboard({ highlight, showLabels = true, onPress }: KeyboardProps) {
  return (
    <div className="keyboard">
      {NOTES.map((note) => (
        <button
          key={note}
          type="button"
          className="key"
          aria-label={SOLFEGE[note]}
          data-highlight={note === highlight ? 'true' : undefined}
          // 소리 지연을 줄이려면 click(=pointerup 이후)이 아니라 pointerdown 이어야 한다.
          // 우클릭·휠클릭은 컨텍스트 메뉴만 띄우고 발음시키지 않는다.
          onPointerDown={(e) => {
            if (e.button === 0) onPress(note)
          }}
          // Enter/Space 와 스크린리더 활성화는 pointer 이벤트를 만들지 않고
          // detail 0 의 click 만 만든다. 이 경로가 없으면 키보드로는 연주가 불가능하다.
          onClick={(e) => {
            if (e.detail === 0) onPress(note)
          }}
        >
          {/* 라벨을 숨겨도 스크린리더용 aria-label 은 유지된다 */}
          {showLabels ? <span className="key__label">{SOLFEGE[note]}</span> : null}
        </button>
      ))}
    </div>
  )
}
