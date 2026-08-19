# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Golf Coach — MVP where a user uploads a swing video, it's analyzed with MediaPipe (pose estimation) + Claude (vision), and the user gets written feedback plus recommended drills. Planned-but-not-built modules: tee time booking, lesson booking, handicap/geo matchmaking.

## Repository structure

```
apps/
  api/           Node.js + Express + Prisma REST API (TypeScript)
  pose-worker/   Python + FastAPI + MediaPipe + Claude analysis service
  mobile/        Expo app (iOS / Android / Web) via Expo Router
packages/
  shared-types/  TypeScript types shared between api and mobile
infra/
  docker-compose.yml   Postgres + MinIO (local S3-compatible storage)
```

`apps/api` and `apps/mobile` are npm workspaces (root `package.json`); `packages/shared-types` is a third workspace they both depend on as `@golf-coach/shared-types`. `apps/pose-worker` is a standalone Python service, not part of the npm workspace tree.

## Commands

### Local infra (Postgres + MinIO)
```bash
cd infra && docker compose up -d
```
Postgres on `localhost:5432` (db `golf_coach`, user/pass `golf`/`golf`); MinIO on `localhost:9000` (console `:9001`), with bucket `golf-videos` auto-created and set to anonymous-download.

### Root
```bash
npm install                    # installs api + mobile + shared-types workspaces; postinstall builds shared-types
npm run dev:api                # -> apps/api dev server
npm run dev:mobile             # -> apps/mobile expo start
npm run build:shared-types     # rebuild shared-types after editing packages/shared-types/src
```

### apps/api (from `apps/api/`)
```bash
cp .env.example .env
npm run dev               # tsx watch src/server.ts, http://localhost:4000
npm run build              # tsc -> dist/
npm run start               # node dist/server.js
npm run prisma:generate
npm run prisma:migrate    # prisma migrate dev — apply after editing prisma/schema.prisma
npm run seed                # tsx prisma/seed.ts — loads the exercise library (must run once against a fresh db)
```
No test or lint scripts currently exist in this workspace. `.claude/settings.json` has a pre-approved pattern for smoke-testing the API standalone: run `tsx src/server.ts` with inline env vars on a scratch port (4010), `curl` `/health`, then `pkill -f "tsx src/server.ts"`.

### apps/pose-worker (from `apps/pose-worker/`)
```bash
cp .env.example .env      # needs a real ANTHROPIC_API_KEY
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
No test suite. `python3 -m py_compile app/*.py` is the pre-approved quick syntax check.

### apps/mobile (from `apps/mobile/`)
```bash
cp .env.example .env
npm install
npm run start    # expo start; press "w" for web, or npm run ios / npm run android
```

## Architecture

### End-to-end flow
1. Mobile calls `POST /videos/upload-url` to get a presigned S3/MinIO PUT URL, uploads the video file directly to storage (`apps/mobile/lib/api.ts` → `uploadFileToUrl`).
2. Mobile calls `POST /videos` with the resulting `storageKey`. The API creates a `Video` row with `status=processing` and **fire-and-forgets** a `POST /analyze` to the pose-worker (`apps/api/src/routes/videos.ts` → `triggerAnalysis`). If that request fails to even reach the worker, the API itself flips the video to `failed`; the API does not wait for analysis to complete.
3. pose-worker downloads the video from S3, samples 4 fixed-percentage frames (`address` 0%, `top_of_backswing` 30%, `impact` 55%, `follow_through` 85% — see `apps/pose-worker/app/pose.py`), runs MediaPipe pose estimation on each, and computes joint-angle metrics (shoulder/hip line angle, shoulder-hip separation, spine angle, front knee flex).
4. pose-worker sends the 4 checkpoint frames (as base64 JPEGs) + computed metrics + the full exercise catalog to Claude (`apps/pose-worker/app/coach.py`) using structured output (`output_config.format = json_schema`) to get back a summary, fault tags, and ranked exercise recommendations — constrained to only pick exercises that were in the catalog it was given.
5. pose-worker writes `SwingMetrics` and `SwingAnalysis`/`AnalysisExercise` rows and flips the video to `analyzed` (or `failed` on any pipeline exception) — **via raw SQL through `psycopg`** (`apps/pose-worker/app/db.py`), not through Prisma. The Postgres schema is the single source of truth (`apps/api/prisma/schema.prisma`); if you change it, the raw SQL in `db.py` must be updated to match by hand, there's no generated client on the Python side.
6. Mobile polls `GET /videos/:id` until `status` moves from `processing` to `analyzed`/`failed`.

### Auth
Stateless JWT bearer tokens (`apps/api/src/lib/auth.ts`), 30-day expiry, signed with `JWT_SECRET`. `requireAuth` middleware reads `Authorization: Bearer <token>` and sets `req.userId`. Mobile persists `{token, user}` in `AsyncStorage` (`apps/mobile/lib/auth-context.tsx`) — there's no refresh flow, just re-login on 401.

### API conventions
Express routes validate request bodies with `zod` schemas inline (see `apps/api/src/routes/*.ts`) and return `400` with `parsed.error.flatten()` on failure. Prisma models are never returned directly — everything goes through `apps/api/src/lib/serialize.ts` to shape dates (`toISOString()`) and nested relations (e.g. `recommendedExercises` sorted by `rank`) into the shapes defined in `packages/shared-types`.

### shared-types
`packages/shared-types/src/index.ts` is the single hand-maintained source of the wire types (`Video`, `SwingAnalysis`, `Exercise`, `User`, etc.) consumed by both `apps/api` (server-side serialization shape) and `apps/mobile` (client parsing). It must be built (`npm run build:shared-types`) after edits — `npm install` at the root does this once via `postinstall`, but `tsx watch` / `expo start` do not rebuild it automatically, so re-run the build manually when iterating on shared types.

### Storage keys
S3 object keys follow `swings/<userId>/<uuid>.<mp4|mov>` (`apps/api/src/lib/s3.ts`). MinIO is used locally with `S3_FORCE_PATH_STYLE=true`; both `apps/api` and `apps/pose-worker` need matching `S3_*` env vars pointing at the same bucket.

### Language note
User-facing strings (seed exercise library in `apps/api/prisma/seed.ts`, README) are in Spanish; code, identifiers, and comments are in English. Match this when adding exercises or other user-facing content.
