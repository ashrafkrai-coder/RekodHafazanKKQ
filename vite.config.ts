import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  build: {
    sourcemap: true,
    assetsDir: 'code',
    target: ['esnext'],
    cssMinify: true,
    lib: false,
  },
  plugins: [
    VitePWA({
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectManifest: {
        globDirectory: 'dist',
        globPatterns: ['**/*.{html,js,css,json,webmanifest,png,svg,ico}'],
      },
      injectRegister: false,
      manifest: false,
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
