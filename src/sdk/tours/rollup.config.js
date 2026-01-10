/**
 * Rollup Build Configuration for BotBuilder Tours SDK
 *
 * Builds:
 * - public/tours-sdk.js (UMD format)
 * - public/tours-sdk.esm.js (ES Module)
 * - public/tours-sdk.min.js (Minified UMD)
 *
 * Usage:
 * npm run build:tours-sdk
 * npm run watch:tours-sdk
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { fileURLToPath } from 'url';
import { dirname, resolve as pathResolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const production = process.env.NODE_ENV === 'production';

// Banner for output files
const banner = `/*!
 * BotBuilder Tours SDK v1.0.0
 * (c) ${new Date().getFullYear()} BotBuilder
 * Released under the MIT License
 *
 * Usage:
 * <script src="https://yourdomain.com/tours-sdk.min.js"></script>
 * <script>
 *   BotBuilderTours.init({ apiKey: 'your-api-key' });
 *   BotBuilderTours.startTour('tour-id');
 * </script>
 */`;

const baseConfig = {
  input: pathResolve(__dirname, 'index.js'),
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              browsers: ['> 1%', 'last 2 versions', 'not dead'],
            },
            modules: false,
          },
        ],
      ],
    }),
  ],
  // Handle external CSS imports gracefully
  onwarn(warning, warn) {
    // Ignore CSS import warnings
    if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.endsWith('.css')) {
      return;
    }
    warn(warning);
  },
};

const builds = [
  // UMD build (for script tags)
  {
    ...baseConfig,
    output: {
      file: pathResolve(__dirname, '../../../public/tours-sdk.js'),
      format: 'umd',
      name: 'BotBuilderTours',
      sourcemap: true,
      exports: 'named',
      banner,
      globals: {},
      // Expose as window.BotBuilderTours
      footer: `
if (typeof window !== 'undefined') {
  window.BotBuilderTours = window.BotBuilderTours || {};
  Object.assign(window.BotBuilderTours, BotBuilderTours);
  // Auto-init if data-auto-init attribute is present
  if (document.currentScript && document.currentScript.hasAttribute('data-auto-init')) {
    var apiKey = document.currentScript.getAttribute('data-api-key');
    if (apiKey) {
      window.BotBuilderTours.init({ apiKey: apiKey });
    }
  }
}`
    },
    plugins: [...baseConfig.plugins],
  },
  // UMD minified
  {
    ...baseConfig,
    output: {
      file: pathResolve(__dirname, '../../../public/tours-sdk.min.js'),
      format: 'umd',
      name: 'BotBuilderTours',
      sourcemap: true,
      exports: 'named',
      banner,
      globals: {},
      footer: `
if(typeof window!=='undefined'){window.BotBuilderTours=window.BotBuilderTours||{};Object.assign(window.BotBuilderTours,BotBuilderTours);if(document.currentScript&&document.currentScript.hasAttribute('data-auto-init')){var k=document.currentScript.getAttribute('data-api-key');if(k)window.BotBuilderTours.init({apiKey:k});}}`
    },
    plugins: [
      ...baseConfig.plugins,
      terser({
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
        format: {
          comments: /^!/,
        },
      }),
    ],
  },
  // ESM build (for modern bundlers)
  {
    ...baseConfig,
    output: {
      file: pathResolve(__dirname, '../../../public/tours-sdk.esm.js'),
      format: 'es',
      sourcemap: true,
      banner,
    },
    plugins: [...baseConfig.plugins],
  },
];

export default builds;
