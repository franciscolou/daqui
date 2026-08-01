// Cliente HTTP do ads-backend. A base (`API`) e o token são definidos no
// login e ficam neste módulo — as telas só chamam `api.get/post/...`.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let baseUrl = '';
let token = '';

export function setApiBase(url: string) {
  baseUrl = url.trim().replace(/\/$/, '');
}

export function getApiBase() {
  return baseUrl;
}

export function setToken(value: string) {
  token = value;
}

async function parse(res: Response) {
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.detail) || `Erro ${res.status}`);
  }
  return data;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; base?: string } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, base } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch((base ?? baseUrl) + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await parse(res)) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** Chamadas sem sessão (login, esqueci a senha) contra uma base específica. */
  public: <T>(path: string, body: unknown, base: string) =>
    request<T>(path, { method: 'POST', body, auth: false, base }),

  /**
   * Upload do criativo (imagem/vídeo). Sem `Content-Type` manual: o boundary
   * do FormData precisa vir do próprio fetch.
   */
  async uploadMedia(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${baseUrl}/ads/media`, { method: 'POST', body: formData });
    return (await parse(res)) as { url: string; type: 'image' | 'video' };
  },

  /** Upload autenticado de um arquivo só (foto de perfil). */
  async uploadFile<T>(path: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, { method: 'POST', headers, body: formData });
    return (await parse(res)) as T;
  },
};

export function errorMessage(e: unknown, fallback = 'Algo deu errado.'): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
