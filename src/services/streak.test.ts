import { describe, expect, it } from 'vitest'
import { streak, todayStr, ymd, yesterdayOf } from './streak'

describe('날짜 문자열', () => {
  it('기기 로컬 시간 기준 YYYY-MM-DD 를 만든다', () => {
    // 로컬 자정 직후. UTC 기준으로 바꾸면 전날이 되는 시각이다
    expect(ymd(new Date(2026, 8, 9, 0, 30))).toBe('2026-09-09')
  })

  it('로컬 하루의 끝에서도 같은 날짜다', () => {
    expect(ymd(new Date(2026, 8, 9, 23, 45))).toBe('2026-09-09')
  })

  it('월·일을 두 자리로 채운다', () => {
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('todayStr 는 오늘 날짜를 같은 형식으로 준다', () => {
    expect(todayStr()).toBe(ymd(new Date()))
  })
})

describe('yesterdayOf', () => {
  it('하루 전 날짜를 준다', () => {
    expect(yesterdayOf('2026-09-09')).toBe('2026-09-08')
  })

  it('월 경계를 넘는다', () => {
    expect(yesterdayOf('2026-09-01')).toBe('2026-08-31')
  })

  it('연 경계를 넘는다', () => {
    expect(yesterdayOf('2026-01-01')).toBe('2025-12-31')
  })

  it('윤년 2월 29일을 처리한다', () => {
    expect(yesterdayOf('2028-03-01')).toBe('2028-02-29')
  })

  it('정오를 기준으로 계산한다 (자정·서머타임 경계 회피)', () => {
    // 자정 기준이면 서머타임 시작일에 하루가 23시간이 되어 날짜가 밀린다
    const d = new Date('2026-09-09T12:00:00')
    expect(d.getHours()).toBe(12)
  })
})

describe('스트릭 계산', () => {
  const today = '2026-09-09'

  it('연습 기록이 없으면 0', () => {
    expect(streak([], today)).toBe(0)
  })

  it('오늘 연습했으면 1', () => {
    expect(streak([today], today)).toBe(1)
  })

  it('오늘부터 연속 3일이면 3', () => {
    expect(streak(['2026-09-07', '2026-09-08', '2026-09-09'], today)).toBe(3)
  })

  it('오늘 아직 안 했어도 어제까지 이어졌으면 유지된다', () => {
    // 사양: "오늘 안 했다고 바로 0이 되지 않는다"
    expect(streak(['2026-09-07', '2026-09-08'], today)).toBe(2)
  })

  it('이틀을 건너뛰면 0', () => {
    expect(streak(['2026-09-06', '2026-09-07'], today)).toBe(0)
  })

  it('중간에 끊긴 기록은 최근 연속 구간만 센다', () => {
    expect(streak(['2026-09-01', '2026-09-02', '2026-09-08', '2026-09-09'], today)).toBe(2)
  })

  it('순서가 섞여 있어도 결과가 같다', () => {
    expect(streak(['2026-09-09', '2026-09-07', '2026-09-08'], today)).toBe(3)
  })

  it('같은 날짜가 중복돼도 한 번만 센다', () => {
    expect(streak([today, today, '2026-09-08'], today)).toBe(2)
  })

  it('월 경계를 넘어 이어진다', () => {
    expect(streak(['2026-08-31', '2026-09-01'], '2026-09-01')).toBe(2)
  })

  it('미래 날짜는 스트릭에 영향을 주지 않는다', () => {
    expect(streak(['2026-09-20', '2026-09-09'], today)).toBe(1)
  })
})

describe('스트릭 — 잘못된 입력', () => {
  it('형식이 깨진 날짜에도 멈춘다 (무한 루프 방지)', () => {
    expect(streak(['NaN-NaN-NaN'], 'NaN-NaN-NaN')).toBe(1)
  })

  it('날짜 수보다 큰 값을 반환하지 않는다', () => {
    expect(streak(['2026-09-09'], '2026-09-09')).toBeLessThanOrEqual(1)
  })
})
