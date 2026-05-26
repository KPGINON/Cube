import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const relayPort = process.env.RELAY_PORT || process.env.PORT || '3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://localhost:${relayPort}`,
    },
  },
});
