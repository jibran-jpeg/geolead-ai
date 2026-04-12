import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'

// Custom plugin to copy extension files after build
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      const distDir = resolve(__dirname, 'dist')

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'public/manifest.json'),
        resolve(distDir, 'manifest.json')
      )

      // Copy icons
      const iconsDir = resolve(distDir, 'icons')
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true })
      }
      const iconSizes = ['icon16.png', 'icon48.png', 'icon128.png']
      iconSizes.forEach(icon => {
        const src = resolve(__dirname, 'public/icons', icon)
        if (existsSync(src)) {
          copyFileSync(src, resolve(iconsDir, icon))
        }
      })

      // Copy content script
      const contentSrc = resolve(__dirname, 'src/content/scraper.js')
      if (existsSync(contentSrc)) {
        copyFileSync(contentSrc, resolve(distDir, 'content.js'))
      }

      // Copy background script
      const bgSrc = resolve(__dirname, 'src/background/background.js')
      if (existsSync(bgSrc)) {
        copyFileSync(bgSrc, resolve(distDir, 'background.js'))
      }

      // Copy geminiService — fix import path for flat dist layout
      const geminiSrc = resolve(__dirname, 'src/background/geminiService.js')
      if (existsSync(geminiSrc)) {
        let content = readFileSync(geminiSrc, 'utf-8')
        // In src/, the path is ../utils/ but in dist/ everything is flat, so use ./utils/
        content = content.replace(/from\s+['"]\.\.\/utils\//g, "from './utils/")
        writeFileSync(resolve(distDir, 'geminiService.js'), content)
      }

      // Copy agentService (imported by background.js)
      const agentSrc = resolve(__dirname, 'src/background/agentService.js')
      if (existsSync(agentSrc)) {
        copyFileSync(agentSrc, resolve(distDir, 'agentService.js'))
      }

      // Copy fallbackTemplates (imported by geminiService.js)
      const utilsDir = resolve(distDir, 'utils')
      if (!existsSync(utilsDir)) {
        mkdirSync(utilsDir, { recursive: true })
      }
      const fallbackSrc = resolve(__dirname, 'src/utils/fallbackTemplates.js')
      if (existsSync(fallbackSrc)) {
        copyFileSync(fallbackSrc, resolve(utilsDir, 'fallbackTemplates.js'))
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
