// vite.config.ts
// 基于 prjtmpl 模板，移除与掼蛋无关的私有依赖（uview-plus / zhpub / cesium 等）
// @ts-nocheck
import { resolve } from 'node:path';
import uni from '@dcloudio/vite-plugin-uni';
import Unocss from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    AutoImport({
      dts: 'src/auto-imports.d.ts',
      imports: ['vue', 'uni-app', 'pinia'],
      exclude: ['createApp']
    }),
    Components({
      extensions: ['vue'],
      dts: 'src/components.d.ts'
    }),
    uni(),
    Unocss()
  ],
  server: {
    open: false, // 运行后不自动打开浏览器
    base: './'   // 生产环境相对路径，便于部署到子目录
  }
});
