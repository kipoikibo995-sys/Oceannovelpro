import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Big libraries get their own long-cached files; export libs load only when exporting
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (/[\/](firebase|@firebase)[\/]/.test(id)) return 'firebase';
            if (/[\/](@tiptap|prosemirror-[^\/]+|linkifyjs|orderedmap|rope-sequence|w3c-keyname)[\/]/.test(id)) return 'editor';
            if (/[\/](docx|jszip|file-saver|pako)[\/]/.test(id)) return 'export';
            if (/[\/](motion|framer-motion|motion-dom|motion-utils)[\/]/.test(id)) return 'motion';
            if (/[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/.test(id)) return 'react';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
