import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-masucri.png'],
      manifest: {
        name: 'MASUCRI Sistema',
        short_name: 'MASUCRI',
        description: 'Gestión y Producción MASUCRI',
        theme_color: '#212529',
        background_color: '#ffffff',
        display: 'standalone', // Esto oculta la barra del navegador para que parezca app nativa
        icons: [
          {
            src: 'logo-masucri.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-masucri.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})