import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/uplot')) return 'uplot';
          return undefined;
        },
      },
    },
  },
  assetsInclude: ['**/*.glsl'],
});
