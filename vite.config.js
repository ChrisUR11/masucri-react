import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' en vez de 'autoUpdate': así el usuario ve un aviso y decide
      // cuándo actualizar, en lugar de que la app se recargue sola sin avisar
      // (lo cual puede interrumpir a alguien a mitad de un pedido).
      registerType: 'prompt',
      // Registramos el Service Worker nosotros mismos desde React
      // (ver src/components/ActualizacionPWA.jsx) para poder mostrar el toast.
      injectRegister: false,
      includeAssets: ['logo-masucri.png', 'icon-masucri.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        // Font Awesome se sirve desde un CDN. Cuando el service worker ya
        // controla la página, conserva su CSS y fuentes para visitas offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/(css|webfonts)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-awesome-6-4-0',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 12, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      },
      manifest: {
        name: 'MASUCRI Sistema',
        short_name: 'MASUCRI',
        description: 'Gestión y Producción MASUCRI',
        lang: 'es',
        theme_color: '#212529',
        background_color: '#fffaf0',
        display: 'standalone', // Esto oculta la barra del navegador para que parezca app nativa
        icons: [{
          src: 'icon-masucri.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }]
      }
    })
  ]
})
