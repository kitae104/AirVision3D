import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Vitest 전용 설정. 프로덕션 vite.config.ts와 분리해 Cesium 정적 복사 플러그인을
 * 테스트에서 제외한다(테스트는 Cesium 자산이 필요 없다).
 */
export default defineConfig({
  plugins: [react()],
  // 테스트 파일 JSX 변환 시 React 자동 주입 (classic 런타임 폴백에서도 안전)
  esbuild: { jsxInject: `import React from 'react'` },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
