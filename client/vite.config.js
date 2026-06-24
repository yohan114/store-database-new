import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served by the Node/Express server under the /app/ path in
// production (Express serves client/dist). In dev, Vite serves it and proxies
// every /api request to the running Node backend on :5000.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
