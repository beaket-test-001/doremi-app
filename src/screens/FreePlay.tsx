import { useState } from 'react'
import type { AudioEngine } from '../services/audio'
import { Keyboard } from '../widgets/Keyboard'
import type { Note } from '../types'

export interface FreePlayProps {
  audio: AudioEngine
  /** 한 음 연주될 때마다 호출 — 연습 기록(10음 기준) 집계용. 저장 연동은 후속 PR */
  onNotePlayed?: (note: Note) => void
}

export function FreePlay({ audio, onNotePlayed }: FreePlayProps) {
  const [showLabels, setShowLabels] = useState(true)

  function handlePress(note: Note) {
    // unlock은 최초 1회만 실제로 동작하므로 매 터치에서 불러도 무해하다.
    // await 하지 않는 이유: 첫 음도 지연 없이 내보내야 한다 (목표 100ms).
    void audio.unlock()
    audio.play(note)
    onNotePlayed?.(note)
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
