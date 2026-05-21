import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.STUDY_VIDEO_PORT) || 5211,
    strictPort: !!process.env.STUDY_VIDEO_PORT,
    proxy: {
      '/bili': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bili/, ''),
        /** B 站对「非浏览器」UA 常直接 403，代理出站需伪装常见浏览器请求 */
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader(
              'User-Agent',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            )
            proxyReq.setHeader('Referer', 'https://www.bilibili.com/')
            proxyReq.setHeader('Origin', 'https://www.bilibili.com')
          })
        },
      },
    },
  },
})
