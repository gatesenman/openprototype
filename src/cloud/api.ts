import { GpoDocument } from "@/schema/types";

export type Role = "owner" | "editor" | "viewer";

export interface CloudUser {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface ProjectSummary {
  id: number;
  name: string;
  owner_id: number;
  role: Role;
  updated_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  document: GpoDocument;
}

export interface Member {
  user_id: number;
  email: string;
  name: string;
  role: Role;
}

export interface VersionInfo {
  id: number;
  author_id: number | null;
  message: string;
  created_at: string;
}

const API_BASE: string =
  (import.meta.env.VITE_CLOUD_API as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8008/api";

const TOKEN_KEY = "op_cloud_token";

export const cloudToken = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = cloudToken.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("无法连接云端服务，请确认后端已启动 (默认 http://localhost:8008)");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `请求失败 (${res.status})`);
  }
  return body as T;
}

export const cloudApi = {
  base: API_BASE,
  register: (email: string, password: string, name = "") =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<CloudUser>("/auth/me"),
  listProjects: () => request<ProjectSummary[]>("/projects"),
  createProject: (name: string, document: GpoDocument) =>
    request<ProjectDetail>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, document }),
    }),
  getProject: (id: number) => request<ProjectDetail>(`/projects/${id}`),
  saveDocument: (id: number, document: GpoDocument, message = "") =>
    request<ProjectDetail>(`/projects/${id}/document`, {
      method: "PUT",
      body: JSON.stringify({ document, message }),
    }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  listMembers: (id: number) => request<Member[]>(`/projects/${id}/members`),
  inviteMember: (id: number, email: string, role: Role) =>
    request<Member[]>(`/projects/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  removeMember: (id: number, userId: number) =>
    request<void>(`/projects/${id}/members/${userId}`, { method: "DELETE" }),
  listVersions: (id: number) => request<VersionInfo[]>(`/projects/${id}/versions`),
};
