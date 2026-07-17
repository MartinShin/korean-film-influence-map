import { defineConfig } from 'astro/config';

// 허브(www.shinhocheol.com) 경로 프록시 구조에 맞춘 basePath.
// vercel.app 직접 접속 시에도 /cinema 경로로 서빙된다 (repo vercel.json의 rewrites).
export default defineConfig({
  site: 'https://www.shinhocheol.com',
  base: '/cinema',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});
