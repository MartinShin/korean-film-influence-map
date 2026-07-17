import { describe, it, expect } from 'vitest';
import { normalizeTitleKey, filmIdentityKey } from '../src/lib/canonicalize.ts';

describe('제목 정규화', () => {
  it('공백 변형을 하나로 접는다: 바람 불어 좋은 날', () => {
    expect(normalizeTitleKey('바람 불어 좋은 날')).toBe(normalizeTitleKey('바람불어 좋은날'));
  });
  it('띄어쓰기 변형: 인정사정 볼 것 없다', () => {
    expect(normalizeTitleKey('인정사정 볼 것 없다')).toBe(normalizeTitleKey('인정사정 볼것 없다'));
  });
  it('문장부호 변형: 공동경비구역 J.S.A', () => {
    expect(normalizeTitleKey('공동경비구역 J.S.A')).toBe(normalizeTitleKey('공동경비구역 JSA'));
  });
  it('NFC 정규화를 적용한다', () => {
    const nfd = '하녀'.normalize('NFD');
    expect(normalizeTitleKey(nfd)).toBe(normalizeTitleKey('하녀'));
  });
  it('연도가 다르면 다른 식별 키', () => {
    expect(filmIdentityKey('하녀', 1960)).not.toBe(filmIdentityKey('하녀', 2010));
  });
});
