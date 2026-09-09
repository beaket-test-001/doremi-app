import type { Lesson } from '../types'

// 레슨 콘텐츠 정의서(Notion)의 데이터를 그대로 옮긴 것.
// 값을 바꾸려면 먼저 정의서를 고칠 것 — 이 파일은 정의서의 복사본이다.
// 모든 곡은 흰건반 7개(도~시)만 사용한다.
export const LESSONS: Lesson[] = [
  {
    id: 1,
    title: '도·레·미를 만나요',
    steps: [
      {
        type: 'intro',
        text: '피아노 건반에 온 걸 환영해요! 가장 기본이 되는 세 음, 도·레·미부터 시작해요.',
      },
      { type: 'find_key', note: 'C4' },
      { type: 'find_key', note: 'D4' },
      { type: 'find_key', note: 'E4' },
      { type: 'play_sequence', label: '도레미', notes: ['C4', 'D4', 'E4'] },
      { type: 'play_sequence', label: '미레도', notes: ['E4', 'D4', 'C4'] },
      { type: 'play_sequence', label: '도레미레도', notes: ['C4', 'D4', 'E4', 'D4', 'C4'] },
    ],
  },
  {
    id: 2,
    title: '파·솔·라·시까지',
    steps: [
      { type: 'intro', text: '이제 나머지 네 음을 배워서 건반 일곱 개를 모두 알아볼 거예요.' },
      { type: 'find_key', note: 'F4' },
      { type: 'find_key', note: 'G4' },
      { type: 'find_key', note: 'A4' },
      { type: 'find_key', note: 'B4' },
      {
        type: 'play_sequence',
        label: '도부터 시까지 올라가기',
        notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],
      },
      {
        type: 'play_sequence',
        label: '시부터 도까지 내려오기',
        notes: ['B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'],
      },
      { type: 'play_sequence', label: '도·미·솔', notes: ['C4', 'E4', 'G4'] },
    ],
  },
  {
    id: 3,
    title: '첫 곡: 비행기',
    steps: [
      {
        type: 'intro',
        text: "드디어 첫 곡이에요! '비행기'를 두 부분으로 나눠 연습한 뒤 이어서 연주해요.",
      },
      {
        type: 'play_sequence',
        label: '떴다 떴다 비행기',
        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'],
      },
      {
        type: 'play_sequence',
        label: '날아라 날아라',
        notes: ['D4', 'D4', 'D4', 'E4', 'G4', 'G4'],
      },
      {
        type: 'play_sequence',
        label: '비행기 전체',
        notes: [
          'E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4',
          'D4', 'D4', 'D4', 'E4', 'G4', 'G4',
          'E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4',
          'E4', 'D4', 'D4', 'E4', 'D4', 'C4',
        ],
      },
    ],
  },
  {
    id: 4,
    title: '작은별',
    steps: [
      { type: 'intro', text: "'반짝반짝 작은별'을 연주해요. 세 부분으로 나눠 연습해요." },
      {
        type: 'play_sequence',
        label: '반짝반짝 작은별',
        notes: ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'],
      },
      {
        type: 'play_sequence',
        label: '아름답게 비치네',
        notes: ['F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'],
      },
      {
        type: 'play_sequence',
        label: '동쪽 하늘에서도 서쪽 하늘에서도',
        notes: ['G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4'],
      },
      {
        type: 'play_sequence',
        label: '작은별 전체',
        notes: [
          'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
          'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
          'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
          'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
          'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
          'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
        ],
      },
    ],
  },
  {
    id: 5,
    title: '나비야',
    steps: [
      { type: 'intro', text: "마지막 곡 '나비야'예요. 이 곡까지 완주하면 기초 과정 졸업!" },
      { type: 'play_sequence', label: '나비야 나비야', notes: ['G4', 'E4', 'E4', 'F4', 'D4', 'D4'] },
      {
        type: 'play_sequence',
        label: '이리 날아 오너라',
        notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'G4', 'G4'],
      },
      {
        type: 'play_sequence',
        label: '노랑나비 흰나비',
        notes: ['G4', 'E4', 'E4', 'E4', 'F4', 'D4', 'D4'],
      },
      {
        type: 'play_sequence',
        label: '춤을 추며 오너라',
        notes: ['C4', 'E4', 'G4', 'G4', 'E4', 'E4', 'E4'],
      },
      {
        type: 'play_sequence',
        label: '나비야 전체',
        notes: [
          'G4', 'E4', 'E4', 'F4', 'D4', 'D4',
          'C4', 'D4', 'E4', 'F4', 'G4', 'G4', 'G4',
          'G4', 'E4', 'E4', 'E4', 'F4', 'D4', 'D4',
          'C4', 'E4', 'G4', 'G4', 'E4', 'E4', 'E4',
        ],
      },
    ],
  },
]
