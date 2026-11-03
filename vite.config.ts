import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { createApi } from './server/api.mjs';

/** Glob for everything inside a folder at the project root. Globs need forward slashes, also on Windows. */
function rootGlob(dir: string): string {
  return path.resolve(dir).replace(/\\/g, '/') + '/**';
}

/** Same local API as the portable server, so state and reports also work during development. */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      const handleApi = createApi({
        dataDir: path.resolve('data'),
        reportsDir: path.resolve('reports'),
      });
      server.middlewares.use((req, res, next) => {
        handleApi(req, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: {
    port: 5173,
    strictPort: true,
    // Root folders only. "**/data/**" would also stop hot reload for src/data/ and src/reports/.
    watch: { ignored: ['data', 'reports', 'release', '.cache'].map((dir) => rootGlob(dir)) },
  },
});
