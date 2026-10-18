# MASUCRI

Aplicación web para gestionar pedidos, producción, catálogo, caja, historial de clientes y reportes del negocio. Usa React, Vite, Firebase Authentication y Cloud Firestore.

## Desarrollo local

Necesitas Node.js y npm compatibles con las versiones declaradas en `package.json`.

```bash
npm ci
npm run dev
```

La aplicación usa el proyecto de Firebase configurado en `src/config/firebase.js`. Para acceder, la cuenta debe existir en Firebase Authentication y estar autorizada para los datos de Firestore. El inicio de sesión de la interfaz usa Google.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor local de Vite. |
| `npm run build` | Compila la aplicación en `dist/`. |
| `npm run preview` | Previsualiza la compilación. |
| `npm run lint` | Ejecuta ESLint. |
| `npm test` | Ejecuta las pruebas con `node --test`. |
| `npm run deploy` | Publica `dist/` mediante `gh-pages` cuando el destino está configurado. |

## Organización del código

- `src/pages/`: módulos de pedidos, historial, catálogo, caja y reportes.
- `src/components/`: componentes compartidos y avisos de la PWA.
- `src/utils/`: reglas de negocio, formatos, cálculos y operaciones de pedidos.
- `src/hooks/`: suscripciones y estado reutilizable.
- `src/config/firebase.js`: inicialización de Authentication y Firestore.
- `test/`: pruebas de las reglas de negocio que no requieren conexión a Firebase.

Los pagos originados por pedidos guardan `pedido_id` en el movimiento de Caja. La venta rápida, los adelantos, los abonos y los pagos al entregar escriben pedido y movimiento juntos mediante un batch de Firestore. Caja muestra los movimientos vinculados, pero impide editarlos o borrarlos desde allí para conservar el saldo y el historial del pedido. Los movimientos manuales de Caja siguen siendo independientes.

## Trabajo sin conexión

La compilación de producción instala una PWA que guarda la aplicación y sus recursos estáticos para usos posteriores. La primera carga y el inicio de sesión con Google requieren conexión. Font Awesome se guarda para visitas sin conexión una vez que el service worker controle la página y haya descargado sus archivos en una visita con conexión.

El manifiesto usa un icono SVG cuadrado de MASUCRI. Para ampliar la compatibilidad de instalación en navegadores que requieren iconos raster, conviene añadir versiones PNG de 192 y 512 píxeles como respaldo.

Firestore usa caché persistente compartida entre pestañas. Puede mostrar datos consultados anteriormente y conservar escrituras pendientes tras recargar la página. Los datos que nunca se consultaron no están garantizados sin conexión. Las promesas de escritura de Firestore esperan confirmación del servidor: un formulario puede seguir mostrando «Guardando...» hasta que vuelva la conexión. La aplicación no usa una cola IndexedDB propia para sincronizar cambios; Firestore gestiona sus escrituras pendientes.

El caché permanece en el navegador entre sesiones y puede contener datos de clientes. Usa la aplicación solo en dispositivos de confianza y borra los datos del sitio antes de ceder uno.

Las transacciones de Firestore requieren conexión. Borrar un pedido con sus movimientos y descargar un respaldo completo también requieren consultar el servidor: usar una caché parcial podría omitir movimientos. El respaldo descarga pedidos, movimientos y catálogo, pero sus tres consultas no forman una instantánea atómica si hay cambios concurrentes.

## Integridad y acceso

`CORREOS_PERMITIDOS` en `src/App.jsx` limita lo que muestra la interfaz, pero **no protege la base de datos**. Hay que configurar reglas de seguridad de Firestore que comprueben la identidad y los permisos de cada operación. Este repositorio no incluye esas reglas.

El borrado con trazabilidad consulta los movimientos en el servidor y después confirma un batch. La consulta y el batch no son una transacción frente a pagos creados concurrentemente; si se necesita esa garantía, la operación debe coordinarse en el servidor junto con reglas que bloqueen nuevos pagos durante el borrado.
