# Golf Coach

MVP: sube un vídeo de tu swing, se analiza con MediaPipe (pose estimation) + Claude (visión), y recibes feedback y ejercicios recomendados.

Módulos futuros (no incluidos todavía): reserva de tees, reserva de clases, matchmaking por hándicap/geolocalización.

## Estructura

```
apps/
  api/           API REST (Node.js + Express + Prisma)
  pose-worker/   Análisis de swing (Python + FastAPI + MediaPipe + Claude)
  mobile/        App Expo (iOS / Android / Web) — Expo Router
  web/           App web (Vite + React) con detección de postura en el navegador vía WebAssembly
packages/
  shared-types/  Tipos TypeScript compartidos entre api y mobile
infra/
  docker-compose.yml   Postgres + MinIO (almacenamiento S3 local)
```

## Puesta en marcha

### 1. Infraestructura local

```bash
cd infra
docker compose up -d
```

Levanta Postgres en `localhost:5432` y MinIO (S3 compatible) en `localhost:9000` (consola en `:9001`), con el bucket `golf-videos` ya creado.

### 2. API

```bash
cd apps/api
cp .env.example .env
npm install
npm run prisma:migrate   # crea el esquema
npm run seed              # carga la biblioteca de ejercicios
npm run dev                # http://localhost:4000
```

### 3. Pose worker

```bash
cd apps/pose-worker
cp .env.example .env      # añade tu ANTHROPIC_API_KEY
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 4. App móvil/web

```bash

cd apps/mobile
cp .env.example .env
npm install
npm run start              # abre en simulador iOS/Android, o pulsa "w" para web
```

### 5. App web con WebAssembly (alternativa a 3 + 4)

En esta versión, MediaPipe se ejecuta **en el navegador** (WebAssembly, con aceleración GPU si está disponible): se extraen los 4 fotogramas clave, se calculan los ángulos y la API envía todo directamente a Claude. No hace falta levantar el pose worker de Python.

```bash
# en apps/api/.env añade ANTHROPIC_API_KEY (la API llama a Claude directamente)
cd apps/web
cp .env.example .env
npm run dev                # http://localhost:5173
```

El runtime WASM de MediaPipe se copia de `node_modules` a `public/mediapipe/wasm` en cada `dev`/`build`; el modelo de pose (`pose_landmarker_full.task`, ~9 MB) se descarga de Google la primera vez. El vídeo tiene que poder decodificarlo el navegador: los `.mov` en HEVC de iPhone suelen fallar en Chrome, usa MP4 (H.264).

## Flujo de prueba end-to-end

1. Regístrate en la app.
2. Sube un vídeo corto de swing (unos segundos, palo completo visible).
3. La pantalla de detalle hace polling hasta que `status` pasa de `processing` a `analyzed`, mostrando el feedback y los ejercicios recomendados.

Nota: el reparto de checkpoints (dirección / cima del backswing / impacto / follow-through) en `apps/pose-worker/app/pose.py` usa porcentajes fijos del vídeo como heurística inicial — es el punto donde conectar un detector de fases de swing más preciso en el futuro.
