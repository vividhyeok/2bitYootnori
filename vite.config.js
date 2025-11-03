import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포: 저장소명이 '2bitYootnori' 이므로 base 경로를 맞춥니다.
  base: '/2bitYootnori/',
})
