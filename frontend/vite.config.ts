import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:8000',
      '/query': 'http://localhost:8000',
      '/retrieval-debug': 'http://localhost:8000',
      '/documents': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
      '/metrics': 'http://localhost:8000',
    },
  },
})
