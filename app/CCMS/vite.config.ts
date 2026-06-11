import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

// 通过环境变量控制 API 地址（编译时注入）.env.production
// VITE_API_BASE=https://your-server.com  npx tauri build
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 80'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
  ],
  build: {
    target: 'es2015',
  },
  base: './',           // ★ 相对路径，确保 Android file:// 协议下资源加载正确
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,   // 不强制端口独占
    host: true,          // 允许局域网调试
    proxy: {             // 开发时将 /api 请求转发到后端
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
