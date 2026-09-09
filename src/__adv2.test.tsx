import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { LessonPlay } from './screens/LessonPlay'
import { createStorage } from './services/storage'
import type { AudioEngine } from './services/audio'
import type { Lesson } from './types'

function memoryBackend() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}
const fakeAudio = (): AudioEngine => ({
  unlock: vi.fn(async () => {}),
  loadSamples: vi.fn(async () => {}),
  play: vi.fn(),
})
const mount = () =>
  render(<App storage={createStorage(memoryBackend())} audio={fakeAudio()} />)

describe('적대적: 제목 계층', () => {
  it('접근성 트리에 노출되는 h1 개수', () => {
    mount()
    const exposed = screen.getAllByRole('heading', { level: 1 })
    console.log('노출 h1:', exposed.map((h) => h.textContent))
    const inDom = document.querySelectorAll('h1')
    console.log('DOM h1:', [...inDom].map((h) => h.textContent))
    expect(exposed).toHaveLength(1)
  })

  it('연습 탭에는 제목이 없다', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    console.log(
      '연습 탭 h1/h2:',
      screen.queryAllByRole('heading').map((h) => h.textContent),
    )
  })
})

describe('적대적: Shell 안정성', () => {
  it('탭 → 레슨 전환에서 landscape-warn 노드 정체성이 유지된다', async () => {
    mount()
    const before = document.querySelector('.landscape-warn')
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    const after = document.querySelector('.landscape-warn')
    expect(after).toBe(before) // 같은 DOM 노드 = 리마운트 없음 = 재낭독 없음
  })
})

describe('적대적: 도트 vs aria-valuenow 드리프트', () => {
  const L3: Lesson = {
    id: 1,
    title: 't',
    steps: [
      { type: 'find_key', note: 'C4' },
      { type: 'find_key', note: 'D4' },
      { type: 'find_key', note: 'E4' },
    ],
  }
  it('startStep 을 범위 밖으로 줘도 채움 수 = valuenow', () => {
    render(
      <LessonPlay
        lesson={L3}
        startStep={99}
        audio={fakeAudio()}
        onClose={() => {}}
        onHome={() => {}}
        onComplete={() => {}}
        onNextLesson={() => {}}
      />,
    )
    const done = screen.getAllByTestId('step-dot').filter((d) => d.dataset.state === 'done')
    const now = screen.getByRole('progressbar').getAttribute('aria-valuenow')
    console.log('clamp: done=', done.length, 'valuenow=', now, 'valuemax=', screen.getByRole('progressbar').getAttribute('aria-valuemax'))
    expect(done).toHaveLength(Number(now))
  })
  it('음수 startStep', () => {
    render(
      <LessonPlay
        lesson={L3}
        startStep={-5}
        audio={fakeAudio()}
        onClose={() => {}}
        onHome={() => {}}
        onComplete={() => {}}
        onNextLesson={() => {}}
      />,
    )
    const done = screen.getAllByTestId('step-dot').filter((d) => d.dataset.state === 'done')
    const now = screen.getByRole('progressbar').getAttribute('aria-valuenow')
    console.log('neg: done=', done.length, 'valuenow=', now)
    expect(done).toHaveLength(Number(now))
  })
  it('마지막 스텝에서 progressbar 가 100% 에 도달하는가', () => {
    render(
      <LessonPlay
        lesson={L3}
        startStep={2}
        audio={fakeAudio()}
        onClose={() => {}}
        onHome={() => {}}
        onComplete={() => {}}
        onNextLesson={() => {}}
      />,
    )
    const pb = screen.getByRole('progressbar')
    console.log('마지막 스텝: valuenow=', pb.getAttribute('aria-valuenow'), '/ valuemax=', pb.getAttribute('aria-valuemax'), 'valuetext=', pb.getAttribute('aria-valuetext'))
  })
})

