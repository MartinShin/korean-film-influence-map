/**
 * 공개 스냅샷 스키마 검증만 단독 실행 (CI 용).
 * 무결성 전체 검사는 generate-site-data.ts가 수행한다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FilmsFileSchema, DatasetFileSchema } from '../src/data/schema.ts';

const root = join(import.meta.dirname, '..');
const films = FilmsFileSchema.parse(JSON.parse(readFileSync(join(root, 'data', 'public', 'films.v2.json'), 'utf8')));
const dataset = DatasetFileSchema.parse(JSON.parse(readFileSync(join(root, 'data', 'public', 'dataset.v2.json'), 'utf8')));
console.log(`schema OK: films=${films.films.length}, edges=${dataset.edges.length}`);
