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
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo-masucri.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // Variante "maskable": Android recorta el ícono en un círculo/redondeado
            // usando esta versión. Si logo-masucri.png tiene el logo pegado a los
            // bordes, se verá cortado en la pantalla de inicio del celular — revisa
            // que tenga un margen de "zona segura" (~10% alrededor) o sube una
            // versión aparte pensada para esto.
            src: 'logo-masucri.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
