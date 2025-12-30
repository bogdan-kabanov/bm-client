import { defineConfig } from 'vite';
const env = {};
const API_BASE = '/v3';
const result = defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      env.VITE_API_BASE || (command === 'build' ? 'https://api.velartrade.com/v3' : API_BASE)
    ),
  }
}));
console.log('Result:', JSON.stringify(result, null, 2));
