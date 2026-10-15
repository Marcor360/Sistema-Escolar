import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { validarUrlApiBuild } from './src/api/validar-url-build';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode !== 'development') {
    const config = loadEnv(mode, process.cwd(), 'VITE_');
    validarUrlApiBuild(process.env.VITE_API_URL || config.VITE_API_URL);
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
    test: { environment: 'jsdom' },
  };
});
