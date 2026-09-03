// Thin fetch wrapper for dizqueTV's REST API (src/api.js on the server).
// Every screen goes through this rather than calling fetch() directly, so
// error handling and JSON parsing stay consistent in one place.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text || res.statusText)
  }
  if (res.status === 204) {
    return undefined as T
  }
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()
  if (text === '') {
    return undefined as T
  }
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T
  }
  // Some endpoints (e.g. plex-servers POST) reply with a plain-text body.
  return text as unknown as T
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(path).then((r) => handle<T>(r))
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r))
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: 'PUT',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r))
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: 'DELETE',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r))
}
