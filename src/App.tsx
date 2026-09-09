import { useEffect, useMemo, useState } from 'react'
import { createAudioEngine } from './services/audio'
import { FreePlay } from './screens/FreePlay'

// 하단 탭 3개. '레슨 플레이'는 탭 없이 전체 화면으로 열리므로 여기 포함하지 않는다.
const TAB_LABELS = {
  home: '🏠 홈',
  lessons: '🎼 레슨',
  practice: '🎹 연습',
} as const

type TabId = keyof typeof TAB_LABELS

const TAB_IDS = Object.keys(TAB_LABELS) as TabId[]

export function App() {
  const [tab, setTab] = useState<TabId>('home')
  const audio = useMemo(() => createAudioEngine(), [])

  // 사양: "앱 시작 시 샘플 7개를 미리 fetch + decodeAudioData".
  // 디코드는 suspended 컨텍스트에서도 되므로 unlock 을 기다릴 필요가 없다.
  useEffect(() => {
    audio.loadSamples().catch(() => {})
  }, [audio])

  return (
    <div className="app">
      {/* 세로 화면 고정: 가로에서는 CSS 미디어쿼리로 이 안내만 덮어 보여준다 */}
      <div className="landscape-warn" role="alert">
        세로 화면으로 돌려주세요
      </div>

      {TAB_IDS.map((id) => (
        <main
          key={id}
          className="screen"
          role="tabpanel"
          id={`panel-${id}`}
          aria-labelledby={`tab-${id}`}
          // 비활성 패널은 접근성 트리에서 빼되, aria-controls가 가리킬 수 있도록 DOM에는 남긴다
          hidden={id !== tab}
        >
          <h1>{TAB_LABELS[id]}</h1>
          {id === 'practice' ? (
            <FreePlay audio={audio} />
          ) : (
            <p className="placeholder">화면 구현 예정</p>
          )}
        </main>
      ))}

      <nav className="tabbar" role="tablist" aria-label="주요 화면">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={id === tab}
            aria-controls={`panel-${id}`}
            className={id === tab ? 'tab tab--active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </nav>
    </div>
  )
}
