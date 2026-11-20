-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('uploaded', 'processing', 'analyzed', 'failed');

-- CreateEnum
CREATE TYPE "ClubType" AS ENUM ('driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter');

-- CreateEnum
CREATE TYPE "ViewAngle" AS ENUM ('face_on', 'down_the_line', 'other');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handicap" DOUBLE PRECISION,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'uploaded',
    "club_type" "ClubType",
    "view_angle" "ViewAngle",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swing_metrics" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "joint_angles" JSONB NOT NULL,
    "phase_timestamps" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swing_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swing_analyses" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "fault_tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swing_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "demo_url" TEXT,
    "fault_tags" TEXT[],
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_exercises" (
    "analysis_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "analysis_exercises_pkey" PRIMARY KEY ("analysis_id","exercise_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "swing_metrics_video_id_key" ON "swing_metrics"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "swing_analyses_video_id_key" ON "swing_analyses"("video_id");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swing_metrics" ADD CONSTRAINT "swing_metrics_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swing_analyses" ADD CONSTRAINT "swing_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_exercises" ADD CONSTRAINT "analysis_exercises_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "swing_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_exercises" ADD CONSTRAINT "analysis_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

