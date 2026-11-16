# Servicio Python del asistente MASUCRI

La app web sigue consultando y guardando en Firebase. Este servicio interpreta los mensajes con Groq y devuelve acciones estructuradas; no consulta Firestore ni guarda, modifica o elimina datos del negocio. El modelo recibe el texto escrito y los nombres y precios del catálogo incluidos para reconocer productos. Si el mensaje contiene datos personales para un borrador, esos datos forman parte del texto enviado al proveedor de IA.

El servicio valida los tokens de Firebase con las claves públicas de firma de Firebase y comprueba el proyecto, correo verificado, inicio con Google y la lista de administradores. No necesita una clave privada de cuenta de servicio. Las búsquedas, los cálculos y la confirmación de pedidos siguen ocurriendo en la app.

## Ejecución local

1. Instala Python 3.11 o posterior.
2. Desde esta carpeta, crea un entorno virtual e instala `requirements.txt`.
3. Copia `.env.example` a `.env` y configura `AI_API_KEY` con la clave de Groq. No la copies al frontend ni al repositorio.
4. En el `.env` de la raíz, configura `VITE_ASISTENTE_API_URL=http://127.0.0.1:8000` y `VITE_ASISTENTE_REMOTO=true`.
5. Ejecuta `uvicorn main:app --reload --port 8000 --env-file .env` desde `assistant_backend/` y `npm run dev` desde la raíz.

## Publicación gratis en Render

El archivo `render.yaml` de la raíz crea un servicio web Docker en el plan Free. Para publicarlo, crea una cuenta gratuita de Render, conecta este repositorio y crea un Blueprint desde `render.yaml`. En la configuración inicial, pega la clave de Groq cuando Render la solicite para `AI_API_KEY`; la clave queda como variable secreta del servicio, nunca en GitHub Pages.

Al terminar el primer deploy, copia la URL HTTPS asignada al servicio. En la compilación de la web configura:

```env
VITE_ASISTENTE_API_URL=https://URL-REAL-DEL-SERVICIO.onrender.com
VITE_ASISTENTE_REMOTO=true
```

Luego vuelve a compilar y publicar GitHub Pages (`npm run build` y `npm run deploy`). La configuración de CORS ya permite el origen `https://chrisur11.github.io`.

Render Free se duerme tras 15 minutos sin tráfico y el siguiente acceso puede tardar cerca de un minuto en responder. No se debe añadir una tarjeta si se quiere evitar cargos: al superar los límites gratuitos, Render suspende servicios o detiene nuevas compilaciones cuando no hay método de pago. Este plan es adecuado para probar el asistente, no ofrece disponibilidad garantizada para producción.
