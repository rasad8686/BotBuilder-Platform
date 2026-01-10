/**
 * Vite Build Configuration for BotBuilder Tours SDK
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'index.js'),
      name: 'BotBuilderTours',
      formats: ['umd', 'es'],
      fileName: (format) => {
        if (format === 'umd') return 'botbuilder-tours.js';
        if (format === 'es') return 'botbuilder-tours.esm.js';
        return `botbuilder-tours.${format}.js`;
      },
    },
    outDir: resolve(__dirname, '../../../dist/sdk'),
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'botbuilder-tours.css';
          return assetInfo.name;
        },
        globals: {},
      },
    },
    cssCodeSplit: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
