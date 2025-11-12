// lib/api.ts
export type ApiResponse<T> = { ok: boolean; status: number | null; data?: T; error?: any };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function request(path: string, options: RequestInit = {}): Promise<ApiResponse<any>> {
  try {
    const headers = (options.headers instanceof Headers) ? options.headers : (options.headers || {});
    const token = (typeof window !== 'undefined') ? localStorage.getItem('celts_token') : null;
    if (token) { (headers as any)['Authorization'] = `Bearer ${token}`; }
    (headers as any)['Content-Type'] = (headers as any)['Content-Type'] || 'application/json';

    const res = await fetch(API_BASE + path, { ...options, headers, credentials: 'include' });

    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) { payload = text; }

    if (!res.ok) {
      return { ok: false, status: res.status, error: payload || { message: 'Request failed' } };
    }
    return { ok: true, status: res.status, data: payload };
  } catch (err: any) {
    // Network error or CORS blocked
    return { ok: false, status: null, error: { message: err.message || 'Network error' } };
  }
}

export async function apiPost(path: string, body: any) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiGet(path: string) { 
  return request(path, { method: 'GET' }); 
}
export async function apiPut(path: string, body: any) {
  return request(path, { method: "PUT", body: JSON.stringify(body) });
}

export async function apiDelete(path: string) {
  return request(path, { method: "DELETE" });
}

export default { apiGet, apiPost, apiPut, apiDelete };
