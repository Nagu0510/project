import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Same-origin API in dev: the httpOnly refresh cookie needs localhost and the API on one site.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_react: ['react', 'react-dom', 'react-router-dom'],
          vendor_ui: ['framer-motion', 'lucide-react', 'canvas-confetti'],
          vendor_three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
