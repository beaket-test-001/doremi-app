// 구현 가이드의 Dart 스니펫을 TS 로 이식한 것.
//
// 이식 주의: Dart 의 DateTime.now().toIso8601String() 은 로컬 시각을 그대로
// 문자열화하므로 앞 10자가 곧 로컬 날짜다. JS 의 toISOString() 은 UTC 라
// 그대로 쓰면 한국 시간 오전 0~9시에 전날로 밀린다. 그래서 직접 조립한다.

/** 기기 로컬 시간 기준 YYYY-MM-DD */
export function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayStr(): string {
  return ymd(new Date())
}

export function yesterdayOf(date: string): string {
  // 정오 기준으로 계산해 자정·서머타임 경계를 회피한다.
  // 'YYYY-MM-DDTHH:mm:ss' (Z 없음)는 로컬 시각으로 파싱된다.
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return ymd(d)
}

/**
 * 연속 연습 일수.
 * 오늘 연습했으면 오늘부터, 아직이면 어제부터 하루씩 거슬러 센다
 * — 오늘 안 했다고 바로 0이 되지 않는다.
 */
export function streak(dates: string[], today: string): number {
  const set = new Set(dates)
  let day = set.has(today) ? today : yesterdayOf(today)
  let count = 0
  // 서로 다른 날짜 수를 넘을 수 없다. 이 상한이 없으면 yesterdayOf 가 전진하지
  // 못하는 입력에서 영구 루프가 된다 — 예: 형식이 깨진 날짜, 또는 Pacific/Apia 처럼
  // 달력에 존재하지 않는 날이 있는 지역
  while (set.has(day) && count < set.size) {
    count += 1
    day = yesterdayOf(day)
  }
  return count
}
