/**
 * 빌드 후처리: dist/* 를 dist/cinema/* 로 중첩시킨다.
 * Astro의 base('/cinema')가 URL에만 적용되고 파일 배치는 평평하게 나오므로,
 * 정적 호스트가 rewrite 없이 /cinema/* 를 그대로 서빙할 수 있게 물리 경로를 맞춘다.
 * 404.html은 Vercel이 루트에서 찾으므로 사본을 루트에 남긴다.
 */
import { readdirSync, mkdirSync, renameSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const nested = join(dist, 'cinema');

if (existsSync(nested)) {
  console.log('postbuild: dist/cinema already exists, skip');
  process.exit(0);
}

const entries = readdirSync(dist);
mkdirSync(nested, { recursive: true });
for (const name of entries) {
  renameSync(join(dist, name), join(nested, name));
}

const notFound = join(nested, '404.html');
if (existsSync(notFound)) copyFileSync(notFound, join(dist, '404.html'));

console.log(`postbuild: nested ${entries.length} entries under dist/cinema`);
