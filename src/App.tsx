import { useState } from 'react'

// 하단 탭 3개. '레슨 플레이'는 탭 없이 전체 화면으로 열리므로 여기 포함하지 않는다.
const TABS = [
  { id: 'home', label: '🏠 홈' },
  { id: 'lessons', label: '🎼 레슨' },
  { id: 'practice', label: '🎹 연습' },
] as const

type TabId = (typeof TABS)[number]['id']

export function App() {
  const [tab, setTab] = useState<TabId>('home')
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="app">
      <main
        className="screen"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        <h1>{current.label}</h1>
        <p className="placeholder">화면 구현 예정</p>
      </main>

      <nav className="tabbar" role="tablist" aria-label="주요 화면">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            aria-controls={`panel-${t.id}`}
            className={t.id === tab ? 'tab tab--active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
