import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  // inspectAttr 仅 dev 启用：往生产 DOM 注入调试属性既无意义也暴露源码结构
  plugins: [process.env.NODE_ENV !== 'production' && inspectAttr(), react()].filter(Boolean),
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
