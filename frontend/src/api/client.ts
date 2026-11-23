import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api/v1' })

// Attach JWT token to every request and normalize duplicate baseURL prefixes
api.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('/api/v1/')) {
    config.url = config.url.slice('/api/v1'.length)
  }
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // A JSON content type on a multipart body hides the boundary from Django,
  // so request.FILES stays empty and uploads fail with 422. Let the browser
  // set the multipart header (and boundary) itself.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
