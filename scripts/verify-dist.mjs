import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const forbidden = ['내부영향그래프_파일럿_v1_원본', '.claude', 'AGENTS.md', 'G:\\', 'C:\\Users\\', 'totalTokens', 'totalToolCalls'];
const files = [];
async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) await walk(path); else files.push(path);
  }
}
await walk(resolve('dist'));
for (const path of files) {
  const buffer = await readFile(path);
  const text = buffer.toString('utf8');
  for (const token of forbidden) if (text.includes(token)) throw new Error(`배포 금지 문자열 발견: ${token} in ${path}`);
}
console.log(`배포 산출물 검증 통과: ${files.length} files`);
