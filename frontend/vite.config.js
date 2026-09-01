import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,

    proxy: {
      '/api/auth': 'http://localhost:8082',

      '/api/catalog': 'http://localhost:8081',

      '/api/bookings': 'http://localhost:8083',

      '/api/reviews': 'http://localhost:8083',

      '/api/analyze': 'http://localhost:8084',

      '/api/analytics': 'http://localhost:8085',
    },
  },
});