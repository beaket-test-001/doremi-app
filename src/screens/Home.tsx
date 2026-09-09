import { nextIncompleteLesson } from '../core/progress'
import { LESSONS } from '../data/lessons'
import { streak } from '../services/streak'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export interface HomeProps {
  completed: number[]
  practiceDates: string[]
  /** 오늘 날짜 (YYYY-MM-DD). 주입받아 테스트와 렌더를 고정한다 */
  today: string
  /** 진행 중인 스텝이 있는지 — 버튼 라벨을 '시작하기'/'이어하기' 로 가른다 */
  hasProgress?: boolean
  onContinue: (lessonId: number) => void
}

/** 이번 달 1일이 월요일 시작 그리드에서 몇 칸 뒤인지 (일요일=6) */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7
}

export function Home({
  completed,
  practiceDates,
  today,
  hasProgress = false,
  onContinue,
}: HomeProps) {
  const days = streak(practiceDates, today)
  const allDone = LESSONS.every((l) => completed.includes(l.id))
  // 홈 '이어하기'는 항상 다음 미완료 레슨. 전부 완료면 레슨 1부터 복습
  const nextLesson = nextIncompleteLesson(completed)
  // 스텝을 하나라도 진행했으면 버튼이 실제로 '이어하기' 로 동작한다 —
  // 라벨만 '시작하기' 로 남겨두면 동작과 어긋난다
  const started = completed.length > 0 || hasProgress

  const ctaLabel = allDone
    ? '전체 복습하기'
    : `레슨 ${nextLesson} ${started ? '이어하기' : '시작하기'}`

  const [year, month] = today.split('-').map(Number)
  const monthIndex = month - 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const practiced = new Set(practiceDates)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="home">
      <h1 className="home__title">도레미 🎹</h1>

      <p className="home__streak">
        {days > 0 ? `🔥 ${days}일 연속 연습 중!` : '오늘부터 시작해 볼까요?'}
      </p>

      <button
        type="button"
        className="btn btn--primary home__cta"
        onClick={() => onContinue(allDone ? LESSONS[0].id : nextLesson)}
      >
        {/* 와이어의 ▶ 는 장식 — 스크린리더가 "검은 오른쪽 삼각형" 을 읽지 않게 숨긴다 */}
        {allDone ? null : <span aria-hidden="true">▶ </span>}
        {ctaLabel}
      </button>

      {/* ARIA grid 는 role="row" 가 필수인데, 탭 동작이 없는 정적 표시라
          그리드 내비게이션이 필요 없다. role 을 붙이지 않고 날짜별
          aria-label 로 연습 여부를 전달한다 */}
      <section className="calendar">
        <h2 className="calendar__title">{month}월 연습 캘린더</h2>
        <div className="calendar__grid">
          {WEEKDAYS.map((label) => (
            <span key={label} className="calendar__weekday" aria-hidden="true">
              {label}
            </span>
          ))}
          {Array.from({ length: leadingBlanks(year, monthIndex) }, (_, i) => (
            <span key={`pad-${i}`} data-testid="cal-pad" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const date = `${year}-${pad(month)}-${pad(day)}`
            const done = practiced.has(date)
            return (
              // 탭 동작 없음 (화면 상세 사양) — 버튼이 아니라 정적 셀이다
              <span
                key={day}
                className="calendar__day"
                data-testid="cal-day"
                data-practiced={done ? 'true' : undefined}
                aria-label={done ? `${day}일 연습함` : `${day}일`}
              >
                {day}
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}
