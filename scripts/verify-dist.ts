/**
 * 배포 산출물 유출 검사. dist/ 안에 조사 원본·내부 로그·로컬 경로 흔적이 있으면 실패한다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

const FORBIDDEN = [
  '내부영향그래프_파일럿_v1_원본',
  'AGENTS.md',
  'G:\\',
  'C:\\Users\\',
  'unverified_candidates',
  'untrusted_namuwiki_only',
  'pending_upgrade',
  'review_flag',
  'subagent',
  'tool_uses',
];

const failures: string[] = [];
function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '.claude') failures.push(`.claude 디렉터리 유출: ${p}`);
      walk(p);
      continue;
    }
    if (!/\.(html|json|csv|xml|txt|js|css)$/i.test(name)) continue;
    const text = readFileSync(p, 'utf8');
    for (const needle of FORBIDDEN) {
      if (text.includes(needle)) failures.push(`${needle} 발견: ${p}`);
    }
  }
}

walk(dist);
if (failures.length) {
  console.error('verify:dist 실패:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('verify:dist OK');
