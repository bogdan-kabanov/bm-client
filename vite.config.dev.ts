import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cssLinkPlugin } from './vite-plugin-css-link';

const envDir = resolve(process.cwd(), '..', 'env-config', 'client');
const env = loadEnv('development', envDir, '');

// Use only values from .env file, no fallbacks
const API_BASE = env.VITE_API_BASE || '';
const WS_BASE = env.VITE_WS_BASE || '';

const getAllowedHosts = () => {
  const hosts = env.ALLOWED_HOSTS
    ? env.ALLOWED_HOSTS.split(',').map((host) => host.trim())
    : [];
  const additionalHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim())
    : [];
  return [...hosts, ...additionalHosts];
};

const getCorsOrigins = () => {
  const devOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  
  if (env.CORS_ORIGINS) {
    return [...devOrigins, ...env.CORS_ORIGINS.split(',').map((origin) => origin.trim())];
  }
  const defaultOrigins = [
    'https://velartrade.com',
    'https://www.velartrade.com',
    'https://admin.velartrade.com',
    'https://dashboard.velartrade.com',
    'https://partner.velartrade.com',
    'https://www.partner.velartrade.com',
    'https://partnerserver.velartrade.com',
    'https://www.partnerserver.velartrade.com',
    'https://blockmind.company',
    'https://www.blockmind.company',
    'https://admin.blockmind.company',
  ];
  return [...devOrigins, ...defaultOrigins];
};

export default defineConfig(({ mode, command }) => ({
  envDir: envDir,
  plugins: [
    react({
      fastRefresh: true,
      babel: {
        plugins: [],
      },
      jsxRuntime: 'automatic',
    }),
    // cssLinkPlugin(), // ВРЕМЕННО ОТКЛЮЧЕНО - Vite в dev режиме всегда инжектит стили инлайн через HMR
  ],
  clearScreen: false,
  logLevel: 'warn',
  css: {
    devSourcemap: false,
    postcss: {
      plugins: [],
    },
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api'],
        api: 'modern-compiler',
        outputStyle: 'compressed',
        charset: false,
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
    // Use only values from .env file, no fallbacks
    'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || ''),
    'import.meta.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || ''),
    'import.meta.env.VITE_WS_BASE': JSON.stringify(env.VITE_WS_BASE || ''),
    'import.meta.env.VITE_API_DOMAIN': JSON.stringify(env.VITE_API_DOMAIN || ''),
    'import.meta.env.VITE_CLIENT_DOMAIN': JSON.stringify(env.VITE_CLIENT_DOMAIN || ''),
    'import.meta.env.MODE': JSON.stringify('development'),
    'import.meta.env.PROD': false,
    'import.meta.env.DEV': true,
  },
  build: {
    outDir: 'dist-dev',
    target: 'es2020',
    minify: 'esbuild',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
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
    sourcemap: false, // ВРЕМЕННО ОТКЛЮЧЕНО - вызывает проблемы с производительностью в Chrome DevTools
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
    // ВРЕМЕННО ОТКЛЮЧЕНО - вызывает загрузку всех файлов при старте
    // entries: [
    //   'src/**/*.{tsx,ts,jsx,js}',
    // ],
    exclude: ['d3', 'lightweight-charts', 'chart.js', 'react-icons'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: getAllowedHosts(),
    middlewareMode: false,
    fs: {
      strict: true,
    },
    hmr: env.VITE_HMR_HOST ? {
      host: env.VITE_HMR_HOST,
      port: Number(env.VITE_HMR_SERVER_PORT || ''),
      protocol: env.VITE_HMR_PROTOCOL || '',
      clientPort: Number(env.VITE_HMR_CLIENT_PORT || ''),
      overlay: false,
      client: {
        overlay: false,
      },
    } : {
      overlay: false,
      client: {
        overlay: false,
      },
    },
    watch: {
      usePolling: false,
      ignored: [
        '**/node_modules/**',
        '**/dist-dev/**',
        '**/dist-production/**',
        '**/.git/**',
        '**/logs/**',
        '**/server/logs/**',
        '**/server/src/**/logs/**',
        '**/*.log',
        '**/uploads/**',
        '**/.vite/**',
        '**/coverage/**',
        '**/.nyc_output/**',
      ],
      interval: 1000,
      binaryInterval: 3000,
    },
    cors: {
      origin: (origin, callback) => {
        // В dev-режиме разрешаем все localhost/127.0.0.1/0.0.0.0 варианты
        if (!origin) {
          callback(null, true);
          return;
        }
        
        // Проверяем, является ли origin локальным (localhost, 127.0.0.1, 0.0.0.0)
        const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin);
        
        const allowedOrigins = getCorsOrigins();
        if (isLocalOrigin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    proxy: {
      '/v3': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Ошибка прокси:', err.message);
          });
        },
      },
    },
  },
  base: '/',
}));

