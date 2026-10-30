import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Origin of the deployed API. Production builds default to it so a plain
// `npm run build` is deployable; VITE_API_URL still overrides it.
const PRODUCTION_API_URL = 'https://accounting-ledger-client-api.onrender.com';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiUrl = (
    env.VITE_API_URL || (mode === 'production' ? PRODUCTION_API_URL : '')
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    build: {
      rolldownOptions: {
        input: {
          company: fileURLToPath(new URL('./index.html', import.meta.url)),
          platform: fileURLToPath(
            new URL('./platform/index.html', import.meta.url),
          ),
        },
      },
    },
    // Dev requests stay same-origin so /api/v1 reaches the API through this
    // proxy and the browser applies no CORS rules.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? PRODUCTION_API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
