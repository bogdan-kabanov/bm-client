import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const envDir = resolve(process.cwd(), '..', 'env-config', 'client');
const env = loadEnv('production', envDir, '');

// Use full URL for production if not specified in env
// Default to https://api.velartrade.com/v3 for production
const API_BASE = env.VITE_API_BASE || 'https://api.velartrade.com/v3';
const WS_BASE = '/v3/ws';

export default defineConfig({
  envDir: envDir,
  plugins: [
    react({
      fastRefresh: false,
      babel: {
        plugins: [],
      },
      jsxRuntime: 'automatic',
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@src/shared/styles/index";',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, ''),
      '@src': resolve(__dirname, 'src'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@icons': resolve(__dirname, 'src/assets/icons'),
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(API_BASE),
    'import.meta.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || 'wss://api.velartrade.com/v3/ws'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify(WS_BASE),
    'import.meta.env.VITE_API_DOMAIN': JSON.stringify(env.VITE_API_DOMAIN || 'api.velartrade.com'),
    'import.meta.env.VITE_CLIENT_DOMAIN': JSON.stringify(env.VITE_CLIENT_DOMAIN || 'velartrade.com'),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env.PROD': true,
    'import.meta.env.DEV': false,
    'process.env.NODE_ENV': JSON.stringify('production'),
    '__REACT_REFRESH__': 'false',
    'import.meta.hot': 'undefined',
  },
  build: {
    outDir: 'dist-production',
    target: 'es2020',
    minify: 'esbuild',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        passes: 1,
        unsafe: false,
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unsafe_undefined: false,
        pure_funcs: [],
        keep_classnames: true,
        keep_fnames: true,
      },
      format: {
        comments: false,
        preserve_annotations: true,
      },
      mangle: {
        keep_classnames: true,
        keep_fnames: true,
        properties: false,
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: false,
      esmExternals: true,
      requireReturnsDefault: 'auto',
    },
    rollupOptions: {
      output: {
        format: 'es',
        manualChunks: (id) => {
          if (id.includes('src/shared/lib/hooks') || id.includes('src/app/store')) {
            return undefined;
          }
          if (id.includes('node_modules')) {
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react-router') ||
              id.includes('react-redux') ||
              id.includes('react-i18next') ||
              id.includes('react-icons') ||
              id.includes('react-phone') ||
              id.includes('use-sync-external-store') ||
              id.includes('use-subscription')
            ) {
              return 'react-vendor';
            }
            if (id.includes('@reduxjs') || id.includes('redux')) {
              return 'redux-vendor';
            }
            if (id.includes('chart') || id.includes('lightweight-charts')) {
              return 'chart-vendor';
            }
            if (id.includes('d3')) {
              return 'd3-vendor';
            }
            if (id.includes('i18next')) {
              return 'i18n-vendor';
            }
            if (id.includes('axios') || id.includes('lodash')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash].[ext]`;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
    ],
    exclude: ['d3', 'lightweight-charts'],
  },
  base: '/',
});

