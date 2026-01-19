import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? "/capstone25/cp25ssa2/" : "/",
  plugins: [react(), tailwindcss()],
}))