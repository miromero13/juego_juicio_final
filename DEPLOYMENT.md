# Despliegue

## Render: servidor

1. Crea un Web Service desde este repositorio o usa `render.yaml` como Blueprint.
2. Render toma `server/` como directorio raíz, compila TypeScript y ejecuta `npm run start`.
3. Configura `CLIENT_ORIGIN` con la URL final de Vercel, por ejemplo `https://juego-juicio-final.vercel.app`.
4. Copia la URL HTTPS pública de Render.
5. Opcionalmente ajusta `GAME_DURATION_SECONDS`; el valor predeterminado es `300` (5 minutos).

## Vercel: cliente

1. Importa el mismo repositorio en Vercel.
2. Configura `client` como `Root Directory`.
3. Define `VITE_SERVER_URL` con la URL HTTPS de Render, sin una barra al final.
4. Despliega y usa la URL resultante como valor de `CLIENT_ORIGIN` en Render.

Al cambiar una variable de entorno, vuelve a desplegar el servicio afectado.
