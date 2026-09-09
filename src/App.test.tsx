import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { FLASH_MS } from './screens/LessonPlay'
import type { Analytics, EventName } from './services/analytics'
import type { AudioEngine } from './services/audio'
import { createStorage, type Storage } from './services/storage'
import { todayStr, yesterdayOf } from './services/streak'

function memoryBackend(seed: Record<string, unknown> = {}) {
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(seed)) map.set(k, JSON.stringify(v))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

function fakeAudio(): AudioEngine {
  return { unlock: vi.fn(async () => {}), loadSamples: vi.fn(async () => {}), play: vi.fn() }
}

function recorder() {
  const events: { name: EventName; params?: Record<string, string | number> }[] = []
  const analytics: Analytics = { track: (name, params) => void events.push({ name, params }) }
  return { analytics, events, names: () => events.map((e) => e.name) }
}

function mount(overrides: { storage?: Storage; analytics?: Analytics } = {}) {
  return render(
    <App
      storage={overrides.storage ?? createStorage(memoryBackend())}
      analytics={overrides.analytics}
      audio={fakeAudio()}
    />,
  )
}

function pressKey(name: string) {
  act(() => {
    screen
      .getByRole('button', { name })
      .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  })
  act(() => void vi.advanceTimersByTime(FLASH_MS))
}

const LESSON1_ANSWERS = ['도', '레', '미', '도', '레', '미', '미', '레', '도', '도', '레', '미', '레', '도']

async function finishLesson1() {
  await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
  await userEvent.click(screen.getByRole('button', { name: /1\. / }))
  await userEvent.click(screen.getByRole('button', { name: '다음' }))
  for (const note of LESSON1_ANSWERS) pressKey(note)
}

describe('App 셸', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('하단 탭 3개(홈·레슨·연습)를 렌더링한다', () => {
    mount()
    expect(screen.getByRole('tab', { name: /홈/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /레슨/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /연습/ })).toBeInTheDocument()
  })

  it('첫 진입 시 홈 탭이 선택되어 있다', () => {
    mount()
    expect(screen.getByRole('tab', { name: /홈/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('탭을 누르면 해당 화면으로 전환된다', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    expect(screen.getByRole('tab', { name: /연습/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('탭마다 aria-controls가 실제 존재하는 패널을 가리킨다', () => {
    const { container } = mount()
    for (const tab of screen.getAllByRole('tab')) {
      const id = tab.getAttribute('aria-controls')!
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  })

  it('비활성 패널은 접근성 트리에서 빠진다', () => {
    mount()
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  })

  it('가로 회전 안내를 렌더링한다', () => {
    mount()
    expect(
      screen.getAllByRole('alert').some((el) => el.textContent?.includes('세로 화면')),
    ).toBe(true)
  })

  it('레슨 탭에서 레슨 목록을 보여준다', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('레슨을 열면 탭바 없이 전체 화면으로 전환된다', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    expect(screen.getByRole('heading', { name: /레슨 1/ })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
  })
})

describe('진도 저장', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('저장된 진도를 읽어 이어하기 버튼에 반영한다', () => {
    const backend = memoryBackend({
      'doremi.v1.progress': { completedLessons: [1, 2], currentLesson: 3, currentStep: 2 },
    })
    mount({ storage: createStorage(backend) })
    expect(screen.getByRole('button', { name: '레슨 3 이어하기' })).toBeInTheDocument()
  })

  it('새로고침(재마운트)해도 진도와 스트릭이 유지된다', async () => {
    const backend = memoryBackend()
    const storage = createStorage(backend)
    const first = mount({ storage })
    await finishLesson1()
    first.unmount()

    mount({ storage: createStorage(backend) })
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    expect(screen.getByRole('button', { name: /1\. / })).toHaveAttribute('data-state', 'done')
    expect(screen.getByRole('button', { name: /2\. / })).toHaveAttribute('data-state', 'open')
  })

  it('레슨 스텝 1개를 완료하면 오늘 연습함으로 기록된다', async () => {
    const backend = memoryBackend()
    mount({ storage: createStorage(backend) })
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')

    expect(JSON.parse(backend._map.get('doremi.v1.practice')!).dates).toEqual([todayStr()])
  })

  it('중간에 나갔다 돌아오면 같은 스텝에서 이어진다', async () => {
    mount()
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    expect(screen.getByText('레를 찾아 눌러보세요')).toBeInTheDocument()
  })

  it('완료한 레슨을 다시 하면 진도를 덮어쓰지 않는다', async () => {
    const backend = memoryBackend()
    mount({ storage: createStorage(backend) })
    await finishLesson1()
    await userEvent.click(screen.getByRole('button', { name: '홈으로' }))

    const afterComplete = JSON.parse(backend._map.get('doremi.v1.progress')!)
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')

    expect(JSON.parse(backend._map.get('doremi.v1.progress')!)).toEqual(afterComplete)
  })

  it('저장 불가 브라우저에서는 배너가 뜨고 앱은 계속 쓸 수 있다', async () => {
    const broken: Storage = createStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    })
    mount({ storage: broken })
    expect(
      screen.getAllByRole('alert').some((el) => el.textContent?.includes('저장되지 않아요')),
    ).toBe(true)

    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })
})

describe('스트릭', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('어제까지 이어졌으면 오늘 연습 시 하루 늘어난다', async () => {
    const today = todayStr()
    const backend = memoryBackend({
      'doremi.v1.practice': { dates: [yesterdayOf(yesterdayOf(today)), yesterdayOf(today)] },
    })
    mount({ storage: createStorage(backend) })
    expect(screen.getByText(/2일 연속/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    await userEvent.click(screen.getByRole('tab', { name: /홈/ }))

    expect(screen.getByText(/3일 연속/)).toBeInTheDocument()
  })

  it('자유 연습 10음을 채우면 오늘 연습함으로 기록된다', async () => {
    const backend = memoryBackend()
    mount({ storage: createStorage(backend) })
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))

    for (let i = 0; i < 9; i++) pressKey('도')
    expect(JSON.parse(backend._map.get('doremi.v1.practice')!).dates).toEqual([])

    pressKey('도')
    expect(JSON.parse(backend._map.get('doremi.v1.practice')!).dates).toEqual([todayStr()])
  })

  it('자유 연습 음 수는 세션이 바뀌어도 누적된다', async () => {
    const backend = memoryBackend()
    const first = mount({ storage: createStorage(backend) })
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    for (let i = 0; i < 6; i++) pressKey('도')
    first.unmount()

    mount({ storage: createStorage(backend) })
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    for (let i = 0; i < 4; i++) pressKey('도')
    expect(JSON.parse(backend._map.get('doremi.v1.practice')!).dates).toEqual([todayStr()])
  })
})

describe('GA4 이벤트', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('앱 시작 시 app_open 을 1회 보낸다', () => {
    const rec = recorder()
    mount({ analytics: rec.analytics })
    expect(rec.names().filter((n) => n === 'app_open')).toHaveLength(1)
  })

  it('레슨 진입 시 lesson_start 에 lesson_id 를 담는다', async () => {
    const rec = recorder()
    mount({ analytics: rec.analytics })
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    expect(rec.events.find((e) => e.name === 'lesson_start')?.params).toEqual({ lesson_id: 1 })
  })

  it('스트릭이 증가할 때 streak_updated 를 1회만 보낸다', async () => {
    const rec = recorder()
    mount({ analytics: rec.analytics })
    await userEvent.click(screen.getByRole('tab', { name: /레슨/ }))
    await userEvent.click(screen.getByRole('button', { name: /1\. / }))
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    pressKey('도')
    pressKey('레')
    pressKey('미')

    const updates = rec.events.filter((e) => e.name === 'streak_updated')
    expect(updates).toHaveLength(1)
    expect(updates[0].params).toEqual({ streak_days: 1 })
  })

  it('연습 탭 진입·이탈에 practice_start / practice_complete 를 보낸다', async () => {
    const rec = recorder()
    mount({ analytics: rec.analytics })
    await userEvent.click(screen.getByRole('tab', { name: /연습/ }))
    expect(rec.names()).toContain('practice_start')

    await userEvent.click(screen.getByRole('tab', { name: /홈/ }))
    const done = rec.events.find((e) => e.name === 'practice_complete')
    expect(done).toBeDefined()
    expect(typeof done!.params!.duration).toBe('number')
  })

  it('레슨 완료 시 lesson_complete 에 lesson_id 와 duration 을 담는다', async () => {
    const rec = recorder()
    mount({ analytics: rec.analytics })
    await finishLesson1()
    const done = rec.events.find((e) => e.name === 'lesson_complete')
    expect(done?.params?.lesson_id).toBe(1)
    expect(typeof done?.params?.duration).toBe('number')
  })
})
