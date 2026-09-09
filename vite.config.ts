import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages 서브경로에 배포하므로 base를 고정한다.
// dev · preview · build 를 모두 같은 경로로 두어 로컬 확인이 실제 배포와 일치하게 한다.
// (분기를 두면 preview가 dist의 /doremi-app/ 자산을 찾지 못한다)
export default defineConfig({
  base: '/doremi-app/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
