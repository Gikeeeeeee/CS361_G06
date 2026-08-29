import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/', // Ensure relative asset paths match your S3/CloudFront domain
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})