import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    // Force a single physical three instance — three/webgpu re-exports the core
    // and importing both 'three' and 'three/webgpu' can dual-load otherwise.
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three', 'three/webgpu', 'three/tsl', 'three/addons/controls/OrbitControls.js'],
  },
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
