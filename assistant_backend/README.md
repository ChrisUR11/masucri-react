# Servicio opcional de IA para MASUCRI

La app ya tiene un asistente local que funciona sin este servicio ni proveedor de IA. Este backend Python es solo una ampliación opcional para conectar un modelo generativo más adelante. La app sigue consultando y guardando en Firestore con Firebase; el backend solo interpreta mensajes y no recibe pedidos, clientes, movimientos ni escribe datos del negocio.

## Preparación local

1. Instala Python 3.11 o posterior.
2. Desde esta carpeta, crea un entorno virtual e instala `requirements.txt`.
3. Copia `.env.example` a `.env` y configura las credenciales de Firebase Admin y el proveedor compatible con Chat Completions. La cuenta de servicio solo se usa para verificar el token de Firebase; no se debe copiar al frontend ni al repositorio.
4. En otra terminal, configura `VITE_ASISTENTE_API_URL=http://127.0.0.1:8000` y `VITE_ASISTENTE_REMOTO=true` en el `.env` de la raíz.
5. Ejecuta `uvicorn main:app --reload --port 8000 --env-file .env` desde `assistant_backend/` y `npm run dev` desde la raíz.

El servicio revisa el token de Firebase, el correo verificado y la misma lista de administradores que la app y Firestore. CORS se limita a los orígenes indicados en `ASSISTANT_ALLOWED_ORIGINS`.

El modelo recibe el texto escrito y los nombres/precios del catálogo para identificar productos. La app procesa las búsquedas, ejecuta los cálculos y muestra los borradores. El servicio de IA no guarda, modifica ni elimina información.

## Publicación

El directorio incluye un `Dockerfile` para desplegarlo como servicio HTTPS (por ejemplo, Cloud Run). Configura en el servidor las variables privadas y añade el origen real de GitHub Pages a `ASSISTANT_ALLOWED_ORIGINS`. En Cloud Run, usa una cuenta de servicio con acceso suficiente para validar tokens y guarda `AI_API_KEY` como secreto del servicio. Configura `VITE_ASISTENTE_API_URL` con la URL pública antes de construir la web. GitHub Pages solo sirve la interfaz; no ejecuta Python.
