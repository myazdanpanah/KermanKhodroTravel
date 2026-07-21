import api from './client'

// ─── Purchase Requests ───────────────────────────────────────
export const purchaseRequestsApi = {
  list: (params?: any) => api.get('/api/purchasing/requests/', { params }),
  get: (id: number) => api.get(`/api/purchasing/requests/${id}/`),
  create: (data: any) => api.post('/api/purchasing/requests/', data),
  submit: (id: number) => api.post(`/api/purchasing/requests/${id}/submit/`),
  approve: (id: number) => api.post(`/api/purchasing/requests/${id}/approve/`),
  reject: (id: number) => api.post(`/api/purchasing/requests/${id}/reject/`),
}

// ─── Purchase Orders ─────────────────────────────────────────
export const purchaseOrdersApi = {
  list: (params?: any) => api.get('/api/purchasing/orders/', { params }),
  get: (id: number) => api.get(`/api/purchasing/orders/${id}/`),
  create: (data: any) => api.post('/api/purchasing/orders/', data),
  confirm: (id: number) => api.post(`/api/purchasing/orders/${id}/confirm/`),
  cancel: (id: number) => api.post(`/api/purchasing/orders/${id}/cancel/`),
  close: (id: number) => api.post(`/api/purchasing/orders/${id}/close/`),
}

// ─── Goods Receipts ──────────────────────────────────────────
export const goodsReceiptsApi = {
  list: (params?: any) => api.get('/api/purchasing/goods-receipts/', { params }),
  get: (id: number) => api.get(`/api/purchasing/goods-receipts/${id}/`),
  accept: (id: number) => api.post(`/api/purchasing/goods-receipts/${id}/accept/`),
}

// ─── Purchasing Summary ──────────────────────────────────────
export const purchasingSummaryApi = {
  get: () => api.get('/api/purchasing/summary/'),
}
