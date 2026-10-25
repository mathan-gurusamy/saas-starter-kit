import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server proxies /api to the API so the httpOnly refresh cookie is same-origin.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
