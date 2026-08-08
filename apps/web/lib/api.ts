"use client"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
const BASE = `${API_URL}/api/v1`

let accessToken: string | null = null
export function setAccessToken(token: string | null) {
  accessToken = token
}
export function getAccessToken() {
  return accessToken
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

interface Options {
  method?: string
  body?: unknown
  /** try a silent refresh + retry on 401 */
  retry?: boolean
}

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401 && opts.retry !== false && path !== "/auth/refresh") {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(path, { ...opts, retry: false })
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (
      json as { error?: { code: string; message: string; details?: unknown } }
    ).error
    throw new ApiError(
      res.status,
      err?.code ?? "ERROR",
      err?.message ?? "Request failed",
      err?.details
    )
  }
  return (json as { data: T }).data
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
    if (!res.ok) return false
    const { data } = await res.json()
    setAccessToken(data.accessToken)
    return true
  } catch {
    return false
  }
}

/** Multipart upload (e.g. profile photo). Lets the browser set the boundary. */
async function upload<T>(
  path: string,
  form: FormData,
  retry = true
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
    body: form,
  })
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return upload<T>(path, form, false)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = (
      json as { error?: { code: string; message: string; details?: unknown } }
    ).error
    throw new ApiError(
      res.status,
      err?.code ?? "ERROR",
      err?.message ?? "Upload failed",
      err?.details
    )
  }
  return (json as { data: T }).data
}

/** Authenticated binary download → triggers a browser save (e.g. PDF report). */
async function download(
  path: string,
  filename: string,
  retry = true
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    credentials: "include",
  })
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh()
    if (refreshed) return download(path, filename, false)
  }
  if (!res.ok)
    throw new ApiError(
      res.status,
      "DOWNLOAD_FAILED",
      "Could not generate the file"
    )
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  upload,
  download,
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  refresh: tryRefresh,
}
