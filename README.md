# MASUCRI

Aplicación web para gestionar pedidos, producción, catálogo, caja, historial de clientes y reportes del negocio. Usa React, Vite, Firebase Authentication y Cloud Firestore.

## Desarrollo local

Necesitas Node.js 24 o posterior y npm. Las pruebas importan módulos `.ts` mediante el soporte nativo de Node; el build comprueba sus tipos con `tsc` antes de compilar con Vite.

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
| `npm run typecheck` | Comprueba los módulos TypeScript antes de compilar. |
| `npm test` | Ejecuta las pruebas con `node --test`. |
| `npm run test:rules` | Prueba los permisos de Firestore en el emulador local. |
| `npm run deploy` | Publica `dist/` mediante `gh-pages` cuando el destino está configurado. |

## Organización del código

- `src/pages/`: módulos de pedidos, historial, catálogo, caja y reportes.
- `src/components/`: componentes compartidos y avisos de la PWA.
- `src/utils/`: reglas de negocio, formatos, cálculos y operaciones de pedidos.
- `src/services/`: acceso a servicios externos y exportaciones, incorporado gradualmente.
- `src/hooks/`: suscripciones y estado reutilizable.
- `src/config/firebase.js`: inicialización de Authentication y Firestore.
- `test/`: pruebas de las reglas de negocio que no requieren conexión a Firebase.

La separación de responsabilidades y los próximos pasos están en [docs/arquitectura.md](docs/arquitectura.md).

Los pedidos nuevos y las ventas rápidas admiten varios productos, descuentos y pagos iniciales. Los pedidos anteriores conservan su formato al consultarlos; se convierten a líneas de productos solo si se editan y guardan.

Los pagos originados por pedidos guardan `pedido_id` en el movimiento de Caja. La venta rápida y los adelantos iniciales escriben pedido y movimiento juntos mediante un batch de Firestore. Los abonos y los pagos al entregar usan transacciones para comprobar el saldo vigente antes de registrar ambos documentos. Caja muestra los movimientos vinculados, pero impide editarlos o borrarlos desde allí. Si un abono fue registrado por error, se corrige o anula desde el detalle del pedido: una transacción ajusta el saldo y conserva el movimiento original marcado como anulado. Los movimientos manuales de Caja siguen siendo independientes.

En Catálogo aparecen productos detectados en pedidos recientes que todavía no tienen ficha. Se pueden completar y guardar con costo, precio de venta y proveedor; «Revisar pedidos anteriores» amplía la búsqueda por bloques. Los nombres se comparan sin diferencias de acentos, mayúsculas ni espacios repetidos. Las fichas nuevas usan un ID estable para evitar duplicados entre dispositivos.

## Trabajo sin conexión

La compilación de producción instala una PWA que guarda la aplicación y sus recursos estáticos para usos posteriores. La primera carga y el inicio de sesión con Google requieren conexión. Font Awesome se guarda para visitas sin conexión una vez que el service worker controle la página y haya descargado sus archivos en una visita con conexión.

El manifiesto usa un icono SVG cuadrado de MASUCRI. Para ampliar la compatibilidad de instalación en navegadores que requieren iconos raster, conviene añadir versiones PNG de 192 y 512 píxeles como respaldo.

Firestore usa caché persistente compartida entre pestañas. Puede mostrar datos consultados anteriormente y conservar escrituras pendientes tras recargar la página. Los datos que nunca se consultaron no están garantizados sin conexión. Las promesas de escritura de Firestore esperan confirmación del servidor: un formulario puede seguir mostrando «Guardando...» hasta que vuelva la conexión. La aplicación no usa una cola IndexedDB propia para sincronizar cambios; Firestore gestiona sus escrituras pendientes.

El caché permanece en el navegador entre sesiones y puede contener datos de clientes. Usa la aplicación solo en dispositivos de confianza y borra los datos del sitio antes de ceder uno.

Las transacciones de Firestore requieren conexión, incluidas las correcciones de abonos. Borrar un pedido con sus movimientos y descargar un respaldo completo también requieren consultar el servidor: usar una caché parcial podría omitir movimientos. El respaldo descarga pedidos, movimientos y catálogo, con una hoja separada para abonos anulados, pero sus tres consultas no forman una instantánea atómica si hay cambios concurrentes.

## Integridad y acceso

`CORREOS_PERMITIDOS` en `src/App.jsx` limita lo que muestra la interfaz. `firestore.rules` define la barrera de Firestore: permite leer y escribir únicamente a los dos administradores con sesión de Google y correo verificado. `npm run test:rules` prueba permisos autorizados y rechazados sin acceder a producción. Para que los cambios de ese archivo rijan en producción hay que desplegar las reglas por separado: `npm run deploy` solo publica la web en GitHub Pages.

Para desplegar exclusivamente las reglas en el proyecto correcto, tras probarlas y autenticar Firebase CLI, ejecuta `npx firebase deploy --only firestore:rules --project masucri-65fed`.

El borrado con trazabilidad consulta los movimientos en el servidor y después confirma un batch. La consulta y el batch no son una transacción frente a pagos creados concurrentemente; si se necesita esa garantía, la operación debe coordinarse en el servidor junto con reglas que bloqueen nuevos pagos durante el borrado.
