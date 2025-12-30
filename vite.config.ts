import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import devConfig from './vite.config.dev';
import productionConfig from './vite.config.production';
import { resolve } from 'path';

const envDir = resolve(__dirname, '..', 'env-config', 'client');
const env = loadEnv('development', envDir, '');

const DEFAULT_ALLOWED_HOSTS = [
  'velartrade.com',
  'www.velartrade.com',
  'admin.velartrade.com',
  'dashboard.velartrade.com',
  'blockmind.company',
  'www.blockmind.company',
  'admin.blockmind.company',
];
// Use only values from .env file, no fallbacks
const API_BASE = env.VITE_API_BASE || '';
const WS_BASE = env.VITE_WS_BASE || '';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: envDir,
  plugins: [
    react({
      ...(mode === 'production'
        ? {
            fastRefresh: false,
            babel: {
              plugins: [],
            },
          }
        : {
            fastRefresh: true,
            babel: {
              plugins: [],
            },
          }),
      jsxRuntime: 'automatic',
    }),
  ],
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
    'import.meta.env.MODE': JSON.stringify(mode),
    'import.meta.env.PROD': mode === 'production',
    'import.meta.env.DEV': mode !== 'production',
    ...(mode === 'production' && {
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__REACT_REFRESH__': 'false',
      'import.meta.hot': 'undefined',
    }),
  },
  build: {
    // Оптимизация сборки - используем более новый target для лучшей совместимости с React 19
    target: 'es2020',
    // Используем esbuild для минификации - более надежно с React 19
    // ВАЖНО: Используем консервативные настройки для избежания проблем с порядком инициализации
    minify: mode === 'production' ? 'esbuild' : 'esbuild',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        // Максимально консервативные настройки для React 19
        passes: 1,
        unsafe: false,
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unsafe_undefined: false,
        pure_funcs: [], // Не помечаем функции как pure
        keep_classnames: true, // Сохраняем имена классов
        keep_fnames: true, // Сохраняем имена функций
      },
      format: {
        comments: false,
        preserve_annotations: true, // Сохраняем аннотации
      },
      mangle: {
        keep_classnames: true, // Не манглаем имена классов
        keep_fnames: true, // Не манглаем имена функций
        properties: false, // Не манглаем свойства объектов
      },
    } : undefined,
    // Правильная обработка CommonJS модулей React
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: false,
      esmExternals: true,
      requireReturnsDefault: 'auto',
    },
    rollupOptions: {
      output: {
        // Используем ES модули для правильной загрузки
        format: 'es',
        // Разделение на чанки для лучшего кэширования
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
              id.includes('react-chartjs') ||
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
          if (id.includes('src/pages/landing')) {
            return 'landing';
          }
          if (id.includes('src/pages/trading')) {
            return 'trading';
          }
          if (id.includes('src/widgets/sidebar') || id.includes('src/widgets/header')) {
            return 'navigation';
          }
          if (id.includes('assets/icons') || id.includes('@icons')) {
            return 'icons';
          }
        },
        // Оптимизация имен файлов для кэширования
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
    // Увеличиваем лимит предупреждений
    chunkSizeWarningLimit: 1000,
    // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования производительности в Chrome
    // Source maps только в dev режиме
    sourcemap: false, // process.env.NODE_ENV === 'development',
    // CSS code splitting
    cssCodeSplit: true,
  },
  // Оптимизация для dev режима
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
    ],
    exclude: ['chart.js', 'd3', 'lightweight-charts'], // Исключаем тяжелые библиотеки из предварительной загрузки
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: Array.from(
      new Set([
        ...DEFAULT_ALLOWED_HOSTS,
        ...(env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS
          ? (env.VITE_ALLOWED_HOSTS || process.env.VITE_ALLOWED_HOSTS).split(',')
              .map((host) => host.trim())
              .filter(Boolean)
          : []),
      ])
    ),
    hmr: (() => {
      const hmrHost = env.VITE_HMR_HOST || process.env.VITE_HMR_HOST || '';
      const hmrProtocol = env.VITE_HMR_PROTOCOL || process.env.VITE_HMR_PROTOCOL || '';
      const hmrClientPort = Number(env.VITE_HMR_CLIENT_PORT || process.env.VITE_HMR_CLIENT_PORT || '');

      return {
        host: hmrHost,
        port: Number(env.VITE_HMR_SERVER_PORT || process.env.VITE_HMR_SERVER_PORT || ''),
        protocol: hmrProtocol,
        clientPort: hmrClientPort,
      };
    })(),
    watch: {
      usePolling: false,
    },
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = [
          'https://velartrade.com',
          'https://www.velartrade.com',
          'https://admin.velartrade.com',
          'https://blockmind.company',
          'https://www.blockmind.company',
          'https://admin.blockmind.company',
        ];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    // Отключен proxy - фронтенд всегда использует production API (dist версию)
    proxy: undefined,
  },
}));