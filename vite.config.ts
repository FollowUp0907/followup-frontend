import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 로컬 개발 서버는 /api 요청을 백엔드로 프록시한다.
// 브라우저 -> vite dev server -> 백엔드 이므로 CORS 문제가 발생하지 않는다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_DEV_PROXY_TARGET || 'http://13.124.207.246:8080'

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
        },
      },
    },
  }
})
