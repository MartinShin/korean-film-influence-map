/** OG 이미지(1200x630) 생성 유틸. 수동 실행: node scripts/make-og.ts */
import sharp from 'sharp';
import { join } from 'node:path';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#100f0d"/>
  <g fill="none" stroke-linecap="round">
    <path d="M120 520 C 320 280, 520 300, 700 430" stroke="#c98500" stroke-width="5" opacity="0.9"/>
    <path d="M120 520 C 380 200, 700 220, 980 380" stroke="#3987e5" stroke-width="4" opacity="0.75"/>
    <path d="M330 470 C 520 330, 760 340, 980 380" stroke="#199e70" stroke-width="4" opacity="0.7" stroke-dasharray="2 10"/>
    <path d="M120 520 C 260 380, 420 400, 560 470" stroke="#c98500" stroke-width="4" opacity="0.7"/>
  </g>
  <circle cx="120" cy="520" r="16" fill="#e5ad48"/>
  <circle cx="700" cy="430" r="12" fill="#e5ad48" opacity="0.9"/>
  <circle cx="980" cy="380" r="11" fill="#6aa5ec"/>
  <circle cx="560" cy="470" r="10" fill="#6aa5ec"/>
  <circle cx="330" cy="470" r="9" fill="#3fbe93"/>
  <text x="120" y="150" font-family="Malgun Gothic, sans-serif" font-size="64" font-weight="700" fill="#f3f0e7">한국영화 영향력 지도</text>
  <text x="120" y="215" font-family="Malgun Gothic, sans-serif" font-size="30" fill="#c4c1b6">인용 네트워크로 본 한국영화 순위 실험</text>
  <text x="120" y="590" font-family="Malgun Gothic, sans-serif" font-size="26" fill="#97948a">영향 관계 154건 · 영화 180편 · 근거 출처 전부 공개 - shinhocheol.com/cinema</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(join(import.meta.dirname, '..', 'public', 'og-default.png'));
console.log('public/og-default.png created');
