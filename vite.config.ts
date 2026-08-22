import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// Plugin to automatically resolve relative imports like "../../lib/googleAuth" from any file depth
function resolveLibImportsPlugin(): Plugin {
  const libMap: Record<string, string> = {
    googleAuth: path.resolve(__dirname, 'src/lib/googleAuth.ts'),
    sheetsSync: path.resolve(__dirname, 'src/lib/sheetsSync.ts'),
    firebaseSync: path.resolve(__dirname, 'src/lib/firebaseSync.ts'),
    firebase: path.resolve(__dirname, 'src/lib/firebase.ts'),
    soundNotification: path.resolve(__dirname, 'src/lib/soundNotification.ts'),
    bruneiDate: path.resolve(__dirname, 'src/lib/bruneiDate.ts'),
    api: path.resolve(__dirname, 'src/lib/api.ts'),
    clientStore: path.resolve(__dirname, 'src/lib/clientStore.ts'),
  };

  return {
    name: 'resolve-lib-imports',
    enforce: 'pre',
    resolveId(source) {
      for (const [key, targetPath] of Object.entries(libMap)) {
        if (source.endsWith(`lib/${key}`) || source.endsWith(`lib/${key}.ts`)) {
          return targetPath;
        }
      }
      if (source.endsWith('/types') || source.endsWith('../types') || source.endsWith('../../types')) {
        return path.resolve(__dirname, 'src/types.ts');
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [resolveLibImportsPlugin(), react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, 'src') },
        { find: /^(\.\.\/)+lib\/(.*)$/, replacement: path.resolve(__dirname, 'src/lib/$2') },
        { find: /^\.\/lib\/(.*)$/, replacement: path.resolve(__dirname, 'src/lib/$1') },
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
  };
});
