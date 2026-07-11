import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await desktop.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
await mkdir(resolve('.artifacts'), { recursive: true });

await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.getByRole('heading', { level: 1 }).waitFor();
if (!(await page.getByRole('heading', { level: 1 }).innerText()).includes('영향의 계보')) throw new Error('홈 제목 확인 실패');
await page.screenshot({ path: resolve('.artifacts/home.png'), fullPage: true });
const axe = await new AxeBuilder({ page }).analyze();
const severe = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact || ''));

await page.goto('http://localhost:4321/map/', { waitUntil: 'networkidle' });
await page.locator('.map-stage svg').waitFor();
const edgeCount = await page.locator('.map-edge').count();
if (edgeCount !== 79) throw new Error(`지도 엣지 수 불일치: ${edgeCount}`);
await page.getByLabel('영화 검색').fill('하녀');
await page.getByRole('button', { name: '찾기' }).click();
await page.getByText(/하녀 \(1960\).*연결 관계/).waitFor();
await page.screenshot({ path: resolve('.artifacts/map.png'), fullPage: true });

await page.goto('http://localhost:4321/films/', { waitUntil: 'networkidle' });
await page.getByLabel('제목 검색').fill('하녀');
await page.waitForTimeout(100);
const visibleFilms = await page.locator('.film-item:visible').count();
if (visibleFilms !== 2) throw new Error(`영화 검색 결과 불일치: ${visibleFilms}`);

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mobilePage = await mobile.newPage();
await mobilePage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (overflow) throw new Error('모바일 홈 가로 넘침 발생');
await mobilePage.screenshot({ path: resolve('.artifacts/mobile.png'), fullPage: true });

await mobile.close();
await desktop.close();
await browser.close();

console.log(JSON.stringify({ edgeCount, visibleFilms, severeAxeViolations: severe.map((item) => item.id), consoleErrors: errors }, null, 2));
if (severe.length || errors.length) process.exitCode = 1;
