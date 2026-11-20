# Publicar Golf Coach (Render + Supabase)

Resultado final: un enlace público tipo `https://golf-coach.onrender.com` que los
jugadores abren en el móvil o el ordenador y pueden "Añadir a pantalla de inicio"
como si fuera una app.

| Pieza | Dónde | Coste |
| --- | --- | --- |
| Web (`apps/web`) | Render, static site | Gratis |
| API (`apps/api`) | Render, web service | Gratis (se duerme tras 15 min sin uso; ~30 s en despertar). Plan Starter 7 $/mes para quitarlo |
| Base de datos + vídeos | Supabase | Gratis (500 MB BD, 1 GB archivos, máx. 50 MB por vídeo) |
| Análisis con Claude | Anthropic API | Pago por uso, cada análisis envía 4 imágenes |

## 1. Supabase (base de datos y vídeos)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo. Región: **Central EU (Frankfurt)**. Guarda la contraseña de la base de datos.
2. **Base de datos**: botón **Connect** (arriba) → pestaña *Connection string* → **Session pooler**. Copia la URL (`postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`) y sustituye `[YOUR-PASSWORD]`. Esto es `DATABASE_URL`.
3. **Almacenamiento**: *Storage* → **New bucket** → nombre `golf-videos`, marca **Public bucket**.
4. *Project Settings* → *Storage* → **S3 Connection**: activa *Enable connection via S3 protocol*. Anota:
   - **Endpoint** → `S3_ENDPOINT` (`https://<ref>.supabase.co/storage/v1/s3`)
   - **Region** → `S3_REGION` (p. ej. `eu-central-1`)
   - **New access key** → `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` (el secreto solo se muestra una vez)
5. `S3_PUBLIC_BASE_URL` = `https://<ref>.supabase.co/storage/v1/object/public/golf-videos`

No hace falta crear tablas: la API aplica las migraciones y carga la biblioteca de ejercicios al arrancar.

## 2. Clave de Claude

En https://console.anthropic.com → *API Keys* → crea una clave (`ANTHROPIC_API_KEY`). Añade saldo en *Billing* y pon un límite de gasto mensual.

## 3. Render (web + API)

1. Primero fusiona el pull request `feat/web-wasm` en `main` (Render despliega `main`).
2. Crea una cuenta en https://render.com entrando con GitHub y dale acceso al repo `golf-app`.
3. **New** → **Blueprint** → elige `classglam/golf-app`. Render lee `render.yaml` y propone dos servicios: `golf-coach-api` y `golf-coach`.
4. Rellena las variables que pide (las de los pasos 1 y 2). `JWT_SECRET` se genera solo.
5. **Apply**. El primer despliegue tarda unos minutos.
6. Comprueba la URL que Render ha dado a la API (página del servicio `golf-coach-api`). Si **no** es `https://golf-coach-api.onrender.com`, ve a `golf-coach` → *Environment* → cambia `VITE_API_URL` por la URL real → *Save, rebuild and deploy*.
7. Abre `https://<tu-api>/health`: debe responder `{"ok":true}`.

El enlace para los jugadores es la URL del servicio `golf-coach`.

## 4. Instalar en el móvil

- **Android (Chrome)**: menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari)**: botón compartir → *Añadir a pantalla de inicio*.

## Antes de abrirlo a clientes de pago

- Los vídeos quedan en un bucket público con nombres imposibles de adivinar; si prometes privacidad, cambia a bucket privado con URLs firmadas.
- Añade una página de política de privacidad y condiciones (se procesan vídeos de personas y se envían imágenes a Anthropic).
- Pasa la API al plan Starter para que no se duerma, y vigila el gasto de Claude.
- Dominio propio: en Render, servicio `golf-coach` → *Settings* → *Custom Domains*.
