import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 로컬 개발 서버는 /api 요청을 백엔드로 프록시한다.
// 브라우저 -> vite dev server -> 백엔드 이므로 CORS 문제가 발생하지 않는다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 배포된 백엔드 주소는 저장소에 두지 않는다. .env 의 VITE_DEV_PROXY_TARGET 에 넣는다.
  // (.env 는 gitignore 대상, 값은 .env.example 참고)
  const target = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 3000,
      // 3000 이 막혀 있으면 조용히 다른 포트로 옮겨가지 않고 바로 실패시킨다.
      strictPort: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            // 브라우저가 붙인 Origin/Referer 를 그대로 넘기면 백엔드 CORS 필터가
            // 허용 목록에 없다며 403 "Invalid CORS request" 로 막는다.
            // 여기는 서버 대 서버 호출이라 CORS 자체가 의미 없으므로 떼고 보낸다.
            // (배포용 api/proxy.ts 도 같은 헤더를 떼고 있다 — 두 경로를 맞춘다)
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
              proxyReq.removeHeader('referer')
            })
          },
        },
      },
    },
  }
})
