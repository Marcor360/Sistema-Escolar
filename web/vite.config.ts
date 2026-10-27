import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { validarUrlApiBuild } from './src/api/validar-url-build';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const config = loadEnv(mode, '.', 'VITE_');
    validarUrlApiBuild(config.VITE_API_URL);
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
    test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] },
  };
});
