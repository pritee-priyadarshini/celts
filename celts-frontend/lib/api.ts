// lib/api.ts
export type ApiResponse<T> = { ok: boolean; status: number | null; data?: T; error?: any };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function request(path: string, options: RequestInit = {}): Promise<ApiResponse<any>> {
  try {
    const headers = (options.headers instanceof Headers) ? options.headers : (options.headers || {});
    const token = (typeof window !== 'undefined') ? localStorage.getItem('celts_token') : null;
    if (token) { (headers as any)['Authorization'] = `Bearer ${token}`; }
    
    if (!(options.body instanceof FormData)) {
      (headers as any)['Content-Type'] = (headers as any)['Content-Type'] || 'application/json';
    }

    const res = await fetch(API_BASE + path, { ...options, headers, credentials: 'include' });

    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (e) { payload = text; }

    if (!res.ok) {
      return { ok: false, status: res.status, error: payload || { message: 'Request failed' } };
    }
    return { ok: true, status: res.status, data: payload };
  } catch (err: any) {
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
  return request(path, { method: 'PUT', body: JSON.stringify(body) }); 
}

export async function apiDelete(path: string) { 
  return request(path, { method: 'DELETE' }); 
}

export async function apiPatch(path: string, body: any) {
  return request(path, { method: "PATCH", body: JSON.stringify(body) });
}


/**
 * Upload helper: expects `form` to be FormData and does NOT set JSON Content-Type.
 * Returns ApiResponse with data from the server.
 */
export async function apiUpload(path: string, form: FormData) {
  try {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('celts_token') : null;
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_BASE + path, { method: 'POST', body: form, headers, credentials: 'include' });
    const text = await res.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!res.ok) return { ok: false, status: res.status, error: payload || { message: 'Upload failed' } };
    return { ok: true, status: res.status, data: payload };
  } catch (err: any) {
    return { ok: false, status: null, error: { message: err.message || 'Network error' } };
  }
}

export default { apiGet, apiPost, apiPut, apiDelete, apiUpload, apiPatch };
