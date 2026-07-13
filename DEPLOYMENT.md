# Guía de Despliegue a Producción (SJ Lab)

Este documento describe el procedimiento paso a paso para actualizar la aplicación en producción, incluyendo la base de datos (Cloudflare D1) y el frontend/backend (Cloudflare Pages con OpenNext).

## Requisitos Previos

1. Tener instalado **Node.js** (versión 20+ recomendada).
2. Tener instalado **npm**.
3. Tener acceso a la cuenta de Cloudflare donde está alojado el proyecto (`vcdanielj@gmail.com`).

## 1. Autenticación en Cloudflare (Wrangler)

Antes de realizar cualquier operación en producción, debes asegurarte de tener la sesión iniciada en la CLI de Cloudflare (`wrangler`).

```bash
# Verificar si ya tienes sesión iniciada
npx wrangler whoami

# Si no tienes sesión o es la cuenta incorrecta, inicia sesión:
npx wrangler login
```
*Esto abrirá una pestaña en tu navegador web. Selecciona la cuenta `vcdanielj@gmail.com` y autoriza el acceso.*

## 2. Actualización de la Base de Datos (Migraciones)

Si realizaste cambios en la estructura de la base de datos (archivo `src/db/schema.ts`), debes generar y aplicar las migraciones.

### A. Generar la migración (Solo si cambiaste schema.ts)
```bash
npm run db:generate
```
*Esto creará un nuevo archivo `.sql` en `src/db/migrations/`.*

### B. Aplicar en entorno local (Opcional, para pruebas)
```bash
npm run db:migrate
```

### C. Aplicar en PRODUCCIÓN (Cloudflare D1)
Ejecuta este comando para aplicar los cambios a la base de datos real:
```bash
npm run db:migrate:prod
```
*Verifica que la salida de la terminal confirme que las migraciones se aplicaron exitosamente o que no hay migraciones pendientes.*

## 3. Despliegue de la Aplicación

Una vez que la base de datos esté actualizada (o si solo hiciste cambios de código/interfaz), debes compilar y subir la aplicación a Cloudflare Pages.

Ejecuta el siguiente comando en la raíz del proyecto:
```bash
npm run deploy
```

### ¿Qué hace este comando?
1. `rm -rf .open-next`: Limpia la caché de compilaciones anteriores.
2. `opennextjs-cloudflare build`: Compila el proyecto Next.js y lo adapta para ejecutarse en el entorno de Cloudflare Workers (Edge).
3. `wrangler deploy`: Sube los archivos estáticos y el worker resultante a la red global de Cloudflare.

Al finalizar, la terminal te mostrará la URL de producción (ej. `https://sjlab-app.vcdanielj.workers.dev`).

---

## Solución de Problemas Comunes

- **Error de permisos (EPERM) al hacer login en VSCode/Trae Sandbox:** Si el entorno restringe el acceso al sistema de archivos al hacer `wrangler login`, abre la terminal nativa de tu Mac (Terminal.app) o una terminal estándar, navega a la carpeta del proyecto y ejecuta `npx wrangler login` desde ahí.
- **Diferencias entre Local y Producción:** Recuerda que el entorno local usa una base de datos SQLite emulada en `.wrangler/`, mientras que producción usa Cloudflare D1. Si los datos no coinciden, es normal.
- **Variables de Entorno:** Si agregas nuevas variables de entorno o secretos (claves API), debes configurarlas en el panel web de Cloudflare (Workers & Pages > sjlab-app > Settings > Variables and Secrets) y no solo en tu `.env` local.
