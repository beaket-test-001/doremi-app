import { describe, expect, it } from 'vitest'
import { NOTES, SOLFEGE, type Note } from '../types'
import { LESSONS } from './lessons'

// QA 체크리스트: "레슨 5까지 전부 완주 가능하다 (계이름 시퀀스 오타 없음 —
// 레슨 콘텐츠 정의서와 대조)". 정의서와의 대조를 테스트로 고정한다.
function solfege(notes: Note[]) {
  return notes.map((n) => SOLFEGE[n]).join('')
}

describe('레슨 데이터', () => {
  it('레슨 5개, id는 1~5', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('제목이 정의서와 일치한다', () => {
    expect(LESSONS.map((l) => l.title)).toEqual([
      '도·레·미를 만나요',
      '파·솔·라·시까지',
      '첫 곡: 비행기',
      '작은별',
      '나비야',
    ])
  })

  it('모든 음이 흰건반 7개 안에 있다', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.type === 'find_key') expect(NOTES).toContain(step.note)
        if (step.type === 'play_sequence')
          for (const note of step.notes) expect(NOTES).toContain(note)
      }
    }
  })

  it('첫 스텝은 intro, 마지막 스텝은 play_sequence 다', () => {
    // 레슨 통과 조건: "마지막 play_sequence 를 끝까지 완주하면 완료"
    for (const lesson of LESSONS) {
      expect(lesson.steps[0].type).toBe('intro')
      expect(lesson.steps.at(-1)!.type).toBe('play_sequence')
    }
  })

  it('빈 시퀀스나 빈 intro 문구가 없다', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        if (step.type === 'play_sequence') expect(step.notes.length).toBeGreaterThan(0)
        if (step.type === 'intro') expect(step.text.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("intro 문구의 '○ 부분' 이 실제 연습 프레이즈 수와 맞는다", () => {
    // 레슨 3 intro 가 '세 부분' 이라고 하면서 연습 프레이즈가 2개였던 오류가 있었다.
    // '전체' 로 끝나는 마지막 시퀀스는 이어서 연주하는 것이라 연습 파트에서 제외한다.
    const WORD_TO_COUNT: Record<string, number> = { 두: 2, 세: 3, 네: 4, 다섯: 5 }
    for (const lesson of LESSONS) {
      const intro = lesson.steps[0]
      if (intro.type !== 'intro') continue
      const m = /([두세네]|다섯) 부분으로/.exec(intro.text)
      if (!m) continue

      const sequences = lesson.steps.filter((s) => s.type === 'play_sequence')
      const practiceParts = sequences.filter((s) => !s.label.endsWith('전체')).length
      expect(WORD_TO_COUNT[m[1]], `레슨 ${lesson.id} intro: "${intro.text}"`).toBe(practiceParts)
    }
  })

  it('레슨 1: 도레미 3음을 찾고 3개 시퀀스를 연주한다', () => {
    const [l1] = LESSONS
    expect(l1.steps.filter((s) => s.type === 'find_key')).toHaveLength(3)
    const seqs = l1.steps.filter((s) => s.type === 'play_sequence')
    expect(seqs.map((s) => solfege(s.notes))).toEqual(['도레미', '미레도', '도레미레도'])
  })

  it('레슨 2: 나머지 4음을 찾고 7음 상행·하행을 연주한다', () => {
    const l2 = LESSONS[1]
    expect(
      l2.steps.filter((s) => s.type === 'find_key').map((s) => SOLFEGE[s.note]),
    ).toEqual(['파', '솔', '라', '시'])
    const seqs = l2.steps.filter((s) => s.type === 'play_sequence')
    expect(solfege(seqs[0].notes)).toBe('도레미파솔라시')
    expect(solfege(seqs[1].notes)).toBe('시라솔파미레도')
    expect(solfege(seqs[2].notes)).toBe('도미솔')
  })

  it('레슨 3 비행기: 전체가 앞 두 프레이즈로 시작한다', () => {
    const seqs = LESSONS[2].steps.filter((s) => s.type === 'play_sequence')
    expect(solfege(seqs[0].notes)).toBe('미레도레미미미')
    expect(solfege(seqs[1].notes)).toBe('레레레미솔솔')
    const full = solfege(seqs[2].notes)
    expect(full.startsWith(solfege(seqs[0].notes))).toBe(true)
    expect(full).toBe('미레도레미미미레레레미솔솔미레도레미미미미레레미레도')
  })

  it('레슨 4 작은별: 전체가 세 프레이즈를 포함한다', () => {
    const seqs = LESSONS[3].steps.filter((s) => s.type === 'play_sequence')
    expect(solfege(seqs[0].notes)).toBe('도도솔솔라라솔')
    expect(solfege(seqs[1].notes)).toBe('파파미미레레도')
    expect(solfege(seqs[2].notes)).toBe('솔솔파파미미레')
    const full = solfege(seqs[3].notes)
    for (const phrase of seqs.slice(0, 3)) expect(full).toContain(solfege(phrase.notes))
  })

  it('레슨 5 나비야: 9/9 악보 대조 결과가 반영돼 있다', () => {
    const seqs = LESSONS[4].steps.filter((s) => s.type === 'play_sequence')
    expect(solfege(seqs[0].notes)).toBe('솔미미파레레')
    expect(solfege(seqs[1].notes)).toBe('도레미파솔솔솔')
    // 정의서 확인 항목: '노랑나비 흰나비'는 7음(솔미미미 파레레)
    expect(seqs[2].notes).toHaveLength(7)
    expect(solfege(seqs[2].notes)).toBe('솔미미미파레레')
    // 정의서 확인 항목: '춤을 추며 오너라' = 도미솔솔 미미미
    expect(solfege(seqs[3].notes)).toBe('도미솔솔미미미')
    // 전체는 네 프레이즈를 순서대로 이어붙인 것
    expect(solfege(seqs[4].notes)).toBe(
      seqs.slice(0, 4).map((s) => solfege(s.notes)).join(''),
    )
  })
})
