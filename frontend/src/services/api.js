import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE_URL })

// Attach JWT to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('nv_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('nv_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    const { data } = await api.post('/auth/login', form)
    return data
  },
  register: async (email, fullName, password) => {
    const { data } = await api.post('/auth/register', { email, full_name: fullName, password })
    return data
  },
  me: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  upload: async (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    })
    return data
  },
  list: async () => {
    const { data } = await api.get('/documents/')
    return data
  },
  get: async id => {
    const { data } = await api.get(`/documents/${id}`)
    return data
  },
  delete: async id => api.delete(`/documents/${id}`),
  summarize: async id => {
    const { data } = await api.post(`/documents/${id}/summarize`)
    return data
  },
  insights: async id => {
    const { data } = await api.post(`/documents/${id}/insights`)
    return data
  },
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  createSession: async (title = 'New Chat') => {
    const { data } = await api.post('/chat/sessions', { title })
    return data
  },
  listSessions: async () => {
    const { data } = await api.get('/chat/sessions')
    return data
  },
  getMessages: async sessionId => {
    const { data } = await api.get(`/chat/sessions/${sessionId}/messages`)
    return data
  },
  deleteSession: async sessionId => api.delete(`/chat/sessions/${sessionId}`),
  updateTitle: async (sessionId, title) => {
    const { data } = await api.put(`/chat/sessions/${sessionId}/title`, { title })
    return data
  },
  // Streaming send – returns EventSource-like fetch stream
  sendMessage: (message, sessionId, documentIds = null) => {
    const token = localStorage.getItem('nv_token')
    return fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, session_id: sessionId, document_ids: documentIds, stream: true }),
    })
  },
}

// ── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: async (query, topK = 10, fileType = null) => {
    const params = { q: query, top_k: topK }
    if (fileType) params.file_type = fileType
    const { data } = await api.get('/search/', { params })
    return data
  },
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: async () => {
    const { data } = await api.get('/dashboard/stats')
    return data
  },
}

export default api
