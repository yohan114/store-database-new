// Tiny typed-ish fetch wrapper used by every data hook.
//
// All requests are relative ("/api/...") so the same build works on any LAN
// host: in dev Vite proxies to :5000, in production Express serves both the
// app and the API from the same origin.
//
// When auth lands (Phase 1) the bearer token is read from localStorage and
// attached here automatically — every call already flows through this function.

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const token = localStorage.getItem('auth_token');
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, opts);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path, headers) => request(path, { method: 'DELETE', headers }),
};
