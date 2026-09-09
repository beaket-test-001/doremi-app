import { useState } from 'react'
import type { AudioEngine } from '../services/audio'
import { Keyboard } from '../widgets/Keyboard'
import type { Note } from '../types'

export interface FreePlayProps {
  audio: AudioEngine
  /** 한 음 연주될 때마다 호출 — 그날 누적 10음이면 '연습함' 처리된다 */
  onNotePlayed?: () => void
}

export function FreePlay({ audio, onNotePlayed }: FreePlayProps) {
  const [showLabels, setShowLabels] = useState(true)

  function handlePress(note: Note, eventTimeStampMs: number) {
    // unlock 은 최초 1회만 실제로 동작하므로 매 터치에서 불러도 무해하다.
    // await 하지 않는 이유: 첫 음도 지연 없이 내보내야 한다 (목표 100ms).
    // 컨텍스트 생성은 unlock() 안에서 동기로 끝나므로 바로 아래 play() 가 음을 예약할 수 있다.
    audio.unlock().catch(() => {
      // 오디오를 못 열어도 화면 조작은 계속 가능해야 한다
    })
    audio.play(note, eventTimeStampMs)
    onNotePlayed?.()
  }

  return (
    <div className="freeplay">
      <label className="toggle">
        <input
          type="checkbox"
          role="switch"
          checked={showLabels}
          onChange={(e) => setShowLabels(e.target.checked)}
        />
        계이름 보기
      </label>

      <Keyboard showLabels={showLabels} onPress={handlePress} />
    </div>
  )
}
