import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/wolfsburg-activity-map/',
  plugins: [react()],
  optimizeDeps: {
    include: ['xlsx', 'osmtogeojson'],
  },
})
