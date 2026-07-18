import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatasetFileSchema, FilmsFileSchema } from '../src/data/schema.ts';
import { normalizeTitleKey } from '../src/lib/canonicalize.ts';

const root = join(import.meta.dirname, '..');
const rawDataset = readFileSync(join(root, 'data', 'public', 'dataset.v3.json'), 'utf8');
const rawFilms = readFileSync(join(root, 'data', 'public', 'films.v3.json'), 'utf8');

describe('공개 스냅샷 무결성', () => {
  it('스키마 검증 통과', () => {
    expect(() => FilmsFileSchema.parse(JSON.parse(rawFilms))).not.toThrow();
    expect(() => DatasetFileSchema.parse(JSON.parse(rawDataset))).not.toThrow();
  });
  it('내부 필드가 공개 스냅샷에 없다 (tier는 v3부터 공개 필드)', () => {
    for (const needle of ['batch', 'review_flag', 'pending_upgrade', 'unverified', 'agree', 'evidence_raw']) {
      expect(rawDataset.includes(`"${needle}"`), `${needle} 필드 유출`).toBe(false);
    }
  });
  it('로컬 경로가 없다', () => {
    expect(rawDataset).not.toContain('G:\\');
    expect(rawDataset).not.toContain('C:\\Users');
    expect(rawFilms).not.toContain('G:\\');
  });
  it('출처 URL은 http(s)만', () => {
    const dataset = DatasetFileSchema.parse(JSON.parse(rawDataset));
    for (const e of dataset.edges) {
      for (const s of e.sources) expect(s.url).toMatch(/^https?:\/\//);
    }
  });
  it('근거 발췌문은 300자 이하', () => {
    const dataset = DatasetFileSchema.parse(JSON.parse(rawDataset));
    for (const e of dataset.edges) expect(e.evidence.publicExcerpt.length).toBeLessThanOrEqual(300);
  });
  it('논리적 중복 엣지가 없다 (citing-cited 쌍 유일)', () => {
    const dataset = DatasetFileSchema.parse(JSON.parse(rawDataset));
    const seen = new Set<string>();
    for (const e of dataset.edges) {
      const key = `${e.citingFilmId}>>${e.citedFilmId}`;
      expect(seen.has(key), `중복: ${key}`).toBe(false);
      seen.add(key);
    }
  });
  it('레지스트리 정규화 키 + 연도 ±1 충돌이 없다', () => {
    const films = FilmsFileSchema.parse(JSON.parse(rawFilms)).films;
    for (let i = 0; i < films.length; i++) {
      for (let j = i + 1; j < films.length; j++) {
        const collide =
          normalizeTitleKey(films[i].titleKo) === normalizeTitleKey(films[j].titleKo) &&
          Math.abs(films[i].year - films[j].year) <= 1;
        expect(collide, `${films[i].titleKo}(${films[i].year}) vs ${films[j].titleKo}(${films[j].year})`).toBe(false);
      }
    }
  });
});
