# MASUCRI — Mejoras aplicadas

## Cómo integrar esto en tu proyecto

Copia la carpeta `src/` completa sobre la tuya (respeta las rutas: `pages/`,
`utils/`, `hooks/`, `components/` van todas al mismo nivel donde ya tienes
`config/` y tu `components/TicketImpresion.jsx`). Los 5 archivos que subiste
(`Catalogo.jsx`, `Historial.jsx`, `Pedidos.jsx`, `Finanzas.jsx`, `DashboardBI.jsx`)
van en `src/pages/`; si los tenías en otro lugar, ajusta esa carpeta o las
rutas de import (`../config/firebase`, etc).

Archivos nuevos que necesitas agregar (no reemplazan nada, son adicionales):
- `src/utils/fecha.js`
- `src/utils/formato.js`
- `src/utils/whatsapp.js`
- `src/utils/abonoPedido.js`
- `src/utils/ventaRapida.js`
- `src/utils/metricasNegocio.js`
- `src/hooks/useFirestoreCollection.js`
- `src/components/EstadoCarga.jsx`
- `src/components/FichaPedidoDetalle.jsx`
- `src/components/VentaRapidaModal.jsx`

No se tocó `src/components/TicketImpresion.jsx` ni `src/config/firebase.js`
porque no fueron parte de lo que subiste — si usan algo distinto a lo asumido
aquí (por ejemplo otros nombres de campo), avísame y lo ajusto.

## Bug corregido (importante)

En `Pedidos.jsx`, el botón **"Venta Rápida"** abría un estado (`showVenta`)
pero el `<Modal>` correspondiente nunca se había implementado — solo quedó
un comentario. El botón no hacía nada. Ahora existe `VentaRapidaModal.jsx`,
totalmente funcional, con sus propias validaciones (cliente y producto
obligatorios, precio > 0, pago no puede superar el precio).

## Duplicación eliminada

Estas piezas de lógica estaban copiadas y pegadas en varios archivos, con
pequeñas diferencias entre copias (una fuente típica de bugs cuando se
corrige en un lado y se olvida en el otro):

| Lógica | Antes duplicada en | Ahora vive en |
|---|---|---|
| `obtenerFechaLocal` | Historial, Pedidos, Finanzas, DashboardBI | `utils/fecha.js` |
| Normalizar teléfono + abrir WhatsApp | Pedidos, Historial | `utils/whatsapp.js` |
| Flujo de "Abonar a la deuda" (SweetAlert + Firestore) | Pedidos, Historial | `utils/abonoPedido.js` |
| Cuerpo del modal "Detalle del Pedido" (~60 líneas de JSX) | Pedidos, Historial | `components/FichaPedidoDetalle.jsx` |
| `useEffect` + `onSnapshot` sin loading/error | Los 5 archivos | `hooks/useFirestoreCollection.js` |
| Cálculo de métricas del negocio (~200 líneas) | DashboardBI (un solo archivo, pero muy denso) | `utils/metricasNegocio.js` |

La ventaja práctica: si mañana cambias cómo se normaliza un teléfono, o
agregas un método de pago, lo cambias en un solo lugar y se refleja en
todas las páginas que lo usan.

## Bugs y detalles corregidos

- **Venta Rápida sin modal** (ver arriba) — funcionalidad rota reparada.
- **Sobre-abono**: antes se podía abonar más de lo que el cliente debía
  (ej. deuda ₡5.000, abono ₡50.000 aceptado). Ahora se valida.
- **División por cero en el Dashboard**: si un mes tenía ₡0 en ingresos,
  el cálculo de volatilidad podía dar `NaN`/`Infinity` silenciosamente.
  Ahora está protegido.
- **`m.descripcion` sin valor por defecto** en Finanzas al editar un
  movimiento antiguo sin descripción — podía disparar el warning de React
  "a component is changing an uncontrolled input to be controlled".
- **Adelanto mayor al precio** en "Nuevo Pedido": Venta Rápida ya validaba
  esto, pero el formulario de pedido normal no. Ahora ambos lo validan.
- **Sin manejo de errores de Firestore**: si fallaban los permisos o la
  conexión, las pantallas se quedaban en blanco sin avisar. Ahora se
  muestra un mensaje claro.
- **Sin loading state**: al entrar a cualquier página había un parpadeo de
  "No hay productos/pedidos" antes de que llegaran los datos reales. Ahora
  se muestra un spinner mientras carga.

## Mejoras de UX/accesibilidad

- Botones de solo ícono (editar, eliminar) ahora tienen `aria-label`.
- Estados vacíos más específicos ("sin resultados para tu búsqueda" vs.
  "no hay productos registrados").
- Confirmación suave si guardas un producto con precio de venta menor al
  costo (antes se guardaba sin avisar).
- En Finanzas se consultan los movimientos del historial completo y los filtros
  se aplican antes de limitar las filas visibles en pantalla.
- Botones de guardar muestran "Guardando..." y se deshabilitan mientras la
  escritura a Firestore está en curso, para evitar doble clic / envíos
  duplicados.

## Refactor de arquitectura

- El Kanban de `Pedidos.jsx` (3 columnas casi idénticas, ~25 líneas cada
  una) ahora se genera desde un arreglo `COLUMNAS`. Agregar una columna
  nueva es agregar un objeto, no copiar/pegar JSX.
- El cálculo de métricas de `DashboardBI.jsx` (una función gigante de
  ~150 líneas) se extrajo a `utils/metricasNegocio.js`, dividida en
  funciones pequeñas y con nombre (`categorizarGasto`, `categorizarProducto`,
  `estadisticasBasicas`). El componente ahora solo se encarga de mostrar
  los datos.

## Segunda tanda de mejoras (PWA, buscadores, navegación)

Archivos nuevos:
- `src/components/ActualizacionPWA.jsx` — toast de "hay una versión nueva"
- `src/components/BotonSubir.jsx` — botón flotante para volver arriba
- `src/components/EstadoConexion.jsx` — banner de "sin conexión"
- `src/hooks/useDebounce.js` — debounce genérico para buscadores

Archivos modificados (reemplazan a los que ya tenías):
- `vite.config.js` — `registerType` pasó de `'autoUpdate'` a `'prompt'` y se agregó `injectRegister: false`, porque ahora el registro del Service Worker lo controla `ActualizacionPWA.jsx` a mano (así puede mostrar el toast). También se agregó una entrada `purpose: 'maskable'` al ícono.
- `src/App.jsx` — monta `EstadoConexion`, `BotonSubir` y `ActualizacionPWA` a nivel global.
- `src/components/NavBar.jsx` — el menú ahora se cierra solo al elegir una opción en móvil.
- `src/pages/Catalogo.jsx` — buscador con debounce (250ms) + aviso si vas a borrar el último producto de un proveedor.
- `src/pages/Historial.jsx` y `src/pages/Pedidos.jsx` — buscador con debounce (250ms).

## Mejora móvil y flujo de pedidos

- El tablero de producción apila sus etapas en teléfonos; ya no exige deslizar
  horizontalmente para llegar a "En producción" o "Por Retirar".
- Historial, Caja, reportes de clientes y listas dentro de modales se muestran
  como tarjetas etiquetadas en pantallas pequeñas. Las tablas dejaron de tener
  un scroll vertical separado de la página.
- Los campos y botones tienen áreas táctiles más cómodas. Los formularios de
  pedido abren el teclado numérico al ingresar el teléfono y pueden completar
  nombre y número con el autocompletado del dispositivo.
- Caja permite buscar por concepto, cliente o método de pago; también se puede
  limpiar el filtro y acotar el rango de fechas.
- La creación de un pedido con adelanto, el registro de abonos, la entrega con
  pago y el borrado del pedido con sus movimientos se escriben en una sola
  operación de Firestore. Los adelantos también quedan vinculados al pedido
  mediante `pedido_id` para que se incluyan en su trazabilidad.
- Los filtros de historial de cliente usan los estados que realmente maneja
  Producción: "En producción" y "Por Retirar".

### Notas importantes

**PWA / actualización**: con `registerType: 'prompt'`, cuando subas una nueva
versión y hagas deploy, los usuarios que ya tengan la app abierta (o instalada
en el teléfono) van a ver un toast amarillo abajo: "🔄 Hay una versión nueva
disponible" con un botón "Actualizar ahora". Antes de este cambio, la app se
actualizaba sola en segundo plano sin avisar — lo cual podía interrumpir a
alguien a mitad de un pedido si Vite decidía recargar la página sola.

**Ícono maskable**: agregué la entrada `purpose: 'maskable'` en el manifest
usando el mismo `logo-masucri.png`. Si el logo no tiene margen (zona segura)
alrededor, Android lo va a recortar en círculo al agregarlo a la pantalla de
inicio. Te recomiendo revisarlo en un celular real después del deploy — si
se ve cortado, lo ideal es subir una segunda versión del logo con ~10% de
margen alrededor, dedicada solo a esta entrada del manifest.

**Botón "subir"**: funciona sobre el desplazamiento principal de la página.
Las listas y tablas ya no tienen una barra de desplazamiento independiente,
así que el mismo botón sirve en todos los módulos.

**Indicador sin conexión**: es un aviso informativo. Firestore ya maneja el
modo offline por su cuenta (guarda localmente y sincroniza solo), este banner
solo hace visible ese estado para que el usuario no se confunda pensando que
la app "no está guardando nada".


- No se tocó el modelo de datos en Firestore ni los nombres de campos.
- No se agregó ninguna librería nueva; se conservó Bootstrap y se añadieron
  reglas responsive para adaptar las pantallas pequeñas.
- La categorización de gastos/productos por palabras clave (frágil, pero
  funcional) se mantuvo tal cual — moverla a un catálogo configurable en
  Firestore sería un cambio de producto, no un bugfix, y prefería
  confirmarlo contigo antes de tocarlo.
