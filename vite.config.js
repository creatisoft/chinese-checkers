import { defineConfig } from 'vite'

// Minimal Vite config for the Chinese Checkers project
// Assumption: by "base will be root" we use base: '/' (absolute root URL)
export default defineConfig({
  base: './',
  publicDir: "public",
  build: {
    outDir: "dist",
    
  },
})
