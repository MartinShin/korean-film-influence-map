/**
 * 영화 제목 정규화. 제목 표기 변형(공백, 문장부호)을 하나의 키로 접는다.
 * 규칙: Unicode NFC → 모든 공백·주요 문장부호 제거 → 영문 소문자화.
 * 같은 정규화 키라도 연도가 다르면 다른 영화다 (하녀 1960 vs 하녀 2010).
 */
export function normalizeTitleKey(title: string): string {
  return title
    .normalize('NFC')
    .replace(/[\s.·,!?'"“”‘’()\-:]/g, '')
    .toLowerCase();
}

/** 정규화 키 + 연도로 만든 영화 식별 키 (연도 허용오차 매칭은 호출부에서 처리) */
export function filmIdentityKey(title: string, year: number): string {
  return normalizeTitleKey(title) + '|' + year;
}

/**
 * 알려진 표기 변형. 키는 정식 제목의 정규화 키, 값은 실제 문헌에서 등장한 변형 표기.
 * 레지스트리의 aliases 필드로 내보내져 검색과 회귀 테스트에 쓰인다.
 */
export const KNOWN_ALIASES: Record<string, string[]> = {
  [normalizeTitleKey('바람 불어 좋은 날')]: ['바람불어 좋은날', '바람 불어 좋은날'],
  [normalizeTitleKey('인정사정 볼 것 없다')]: ['인정사정 볼것 없다'],
  [normalizeTitleKey('공동경비구역 JSA')]: ['공동경비구역 J.S.A', 'JSA'],
  [normalizeTitleKey('넘버 3')]: ['넘버3'],
};
