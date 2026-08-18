import type {
  AuthResponse,
  Exercise,
  UploadUrlResponse,
  Video,
} from "@golf-coach/shared-types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ? JSON.stringify(payload.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: { email, password, name } }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }),

  listVideos: (token: string) => request<Video[]>("/videos", { token }),

  getVideo: (token: string, id: string) => request<Video>(`/videos/${id}`, { token }),

  createUploadUrl: (token: string, extension: "mp4" | "mov") =>
    request<UploadUrlResponse>("/videos/upload-url", {
      method: "POST",
      token,
      body: { extension },
    }),

  createVideo: (token: string, storageKey: string) =>
    request<Video>("/videos", { method: "POST", token, body: { storageKey } }),

  listExercises: () => request<Exercise[]>("/exercises"),
};

export async function uploadFileToUrl(uploadUrl: string, fileUri: string, contentType: string) {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    throw new Error(`Upload failed: ${putResponse.status}`);
  }
}
