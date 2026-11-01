# Arquitectura de MASUCRI

## Decisión actual

La aplicación usa React y Vite para la interfaz, GitHub Pages para publicar la PWA, y Firebase Authentication y Cloud Firestore para identidad y datos. Firestore ya cumple la función de backend gestionado. Un servidor propio añadiría despliegue, mantenimiento y latencia sin resolver por sí mismo los problemas de organización del código.

## Responsabilidades del código

| Ubicación | Responsabilidad |
| --- | --- |
| `src/pages/` | Componer la pantalla y coordinar estado, eventos y mensajes. |
| `src/components/` | Mostrar partes de interfaz reutilizables; recibir datos y acciones por props. |
| `src/hooks/` | Encapsular suscripciones y estado React compartido. |
| `src/services/` | Acceder a Firebase y generar archivos externos. |
| `src/utils/` | Calcular y validar datos sin depender de React ni de Firestore, cuando sea posible. |
| `src/config/` | Inicializar servicios externos. |

La migración a estas responsabilidades es gradual: todavía hay páginas que escriben directamente en Firestore. Al editar una de ellas, mover una operación completa junto con su validación y verificar que conserve el esquema de datos.

## Criterios para cambios

1. Conservar los campos y estados de los pedidos existentes. Un dato antiguo puede no tener campos añadidos después.
2. Mantener juntos los cambios de pedido y movimiento de caja. Para saldos concurrentes se usan transacciones; para crear documentos relacionados, operaciones por lote.
3. Separar cálculos puros de consultas, ventanas y descargas. Probar los cálculos y las reglas de dinero cuando un cambio pueda alterar resultados.
4. Conservar la caché persistente de Firestore y verificar los flujos que requieren conexión. Las transacciones no funcionan sin conexión.
5. Ejecutar `npm test`, `npm run test:rules`, `npm run lint`, `npm run typecheck` y `npm run build` antes de publicar.

## Evolución recomendada

- Mantener `firestore.rules` y sus pruebas de Emulator Suite junto al código. Antes de cada despliegue de reglas, comparar su versión local con la desplegada y usar el proyecto de Firebase explícito.
- Continuar con servicios para operaciones de pedidos y catálogo, sin alterar las transacciones existentes durante una extracción solo visual.
- Ampliar TypeScript gradualmente desde dinero y métricas de pedidos activos hacia modelos y reglas de pedidos. Validar en ejecución los datos antiguos de Firestore, porque sus tipos no garantizan el contenido almacenado.
- Usar Cloud Functions solo si una operación necesita privilegios de servidor, integraciones privadas o una garantía de coordinación que el cliente y las reglas no puedan asegurar.
