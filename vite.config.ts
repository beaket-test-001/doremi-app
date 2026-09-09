import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 서브경로(/doremi-app/)에 배포되므로 base를 고정한다.
// 로컬 dev/test에서는 '/' 로 두어야 경로가 꼬이지 않는다.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/doremi-app/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
