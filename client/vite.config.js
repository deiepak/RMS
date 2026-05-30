import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
    },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://server:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://server:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
