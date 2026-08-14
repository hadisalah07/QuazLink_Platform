// Thin fetch helpers over the Express API. No axios/swr in this project —
// native fetch only. Everything hits NEXT_PUBLIC_API_URL.
//
// Auth: Express owns the session (httpOnly `session` cookie). Every request
// must send that cookie, so all calls go through `apiFetch`, which forces
// `credentials: "include"`. Server-side callers (layouts) have no cookie jar,
// so they forward the incoming cookie header explicitly (see getMe).

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('quazlink.site')
    ? 'https://api.quazlink.site'
    : 'http://localhost:3001');

// Central fetch wrapper. `credentials` is spread LAST so no caller can
// accidentally drop the session cookie by passing their own init.
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, { ...init, credentials: "include" });
}

export interface Account {
  id: string;
  platform: string;
  status: "connecting" | "active" | "error" | string;
  lastUsedAt: string | null;
  createdAt: string;
  destinations?: { name: string; url: string }[] | null;
}

export interface Job {
  id: string;
  status: string;
  result: string | null;
  screenshotUrl: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  post: { id: string; content: string | null } | null;
  socialAccount: { id: string; platform: string } | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// --- Auth ---

export async function login(input: { email: string; password: string }): Promise<AuthUser> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function signup(input: {
  email: string;
  password: string;
  name?: string;
  inviteCode?: string;
}): Promise<AuthUser> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function logout(): Promise<void> {
  // 204, no body. Ignore failures — the client redirects to /login regardless.
  await apiFetch("/api/auth/logout", { method: "POST" });
}

// Returns the current user, or null if not authenticated. Works server-side
// (pass the request's cookie header) and browser-side (cookie auto-attached).
export async function getMe(cookieHeader?: string): Promise<AuthUser | null> {
  const res = await apiFetch("/api/auth/me", {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  if (!res.ok) return null;
  return res.json();
}

// --- Accounts ---

export async function connectAccount(platform: string = "facebook"): Promise<{ id: string; status: string; platform: string }> {
  const res = await apiFetch(`/api/accounts/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  return jsonOrThrow(res);
}

export async function getAccounts(): Promise<Account[]> {
  const res = await apiFetch(`/api/accounts`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await apiFetch(`/api/accounts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to delete account (${res.status})`);
  }
}

// Re-detect pages for an already-connected account (reuses the saved session,
// opens a short-lived browser on the worker, refreshes `destinations`).
export async function redetectPages(id: string): Promise<{ status: string }> {
  const res = await apiFetch(`/api/accounts/${id}/detect-pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

export async function createPost(input: {
  content: string;
  socialAccountId: string;
  mediaUrls?: string[];
  targetUrl?: string;
}): Promise<{ jobId: string; postId: string }> {
  const res = await apiFetch(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function getJobs(): Promise<Job[]> {
  const res = await apiFetch(`/api/jobs`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export function screenshotUrl(jobId: string): string {
  return `${API}/api/jobs/${jobId}/screenshot`;
}

export interface Catalog {
  id: string;
  name: string;
  sourceType: string;
  apiUrl: string;
  authScheme: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export async function getCatalogs(): Promise<Catalog[]> {
  const res = await apiFetch(`/api/catalogs`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function addCatalog(input: {
  name: string;
  sourceType?: string;
  apiUrl: string;
  apiKey?: string;
  authScheme?: string;
  authHeader?: string;
}): Promise<Catalog> {
  const res = await apiFetch(`/api/catalogs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

export async function deleteCatalog(id: string): Promise<void> {
  const res = await apiFetch(`/api/catalogs/${id}`, {
    method: "DELETE",
  });
  return jsonOrThrow(res);
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  images: string[];
  productUrl: string | null;
}

export async function getCatalogProducts(id: string): Promise<Product[]> {
  const res = await apiFetch(`/api/catalogs/${id}/products`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function generateCopy(input: {
  product: Product;
  tone?: string;
  language?: string;
}): Promise<{ copy: string }> {
  const res = await apiFetch(`/api/ai/generate-copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow(res);
}

// --- Local Desktop Runner & Devices ---

export interface DeviceItem {
  id: string;
  name: string;
  platform: string;
  status: "online" | "busy" | "offline" | string;
  appVersion: string | null;
  lastHeartbeat: string | null;
  keepAwake: boolean;
  createdAt: string;
}

export interface DevicesResponse {
  devices: DeviceItem[];
  isOnline: boolean;
  activeCount: number;
}

export async function getDevices(): Promise<DevicesResponse> {
  const res = await apiFetch(`/api/devices`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function createDevicePairing(name?: string): Promise<{ deviceId: string; pairingToken: string; instructions: string }> {
  const res = await apiFetch(`/api/devices/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow(res);
}

export async function updateDevice(id: string, data: { name?: string; keepAwake?: boolean }): Promise<DeviceItem> {
  const res = await apiFetch(`/api/devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return jsonOrThrow(res);
}

export async function deleteDevice(id: string): Promise<void> {
  const res = await apiFetch(`/api/devices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to remove device (${res.status})`);
  }
}
