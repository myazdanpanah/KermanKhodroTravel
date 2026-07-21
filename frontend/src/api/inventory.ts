import api from './client'

// ─── Warehouses ──────────────────────────────────────────────
export const warehousesApi = {
  list: () => api.get('/api/inventory/warehouses/'),
  get: (id: number) => api.get(`/api/inventory/warehouses/${id}/`),
  create: (data: any) => api.post('/api/inventory/warehouses/', data),
  update: (id: number, data: any) => api.put(`/api/inventory/warehouses/${id}/`, data),
  delete: (id: number) => api.delete(`/api/inventory/warehouses/${id}/`),
  stock: (id: number) => api.get(`/api/inventory/warehouses/${id}/stock/`),
}

// ─── Stock Movements ─────────────────────────────────────────
export const stockMovementsApi = {
  list: (params?: any) => api.get('/api/inventory/movements/', { params }),
  get: (id: number) => api.get(`/api/inventory/movements/${id}/`),
}

// ─── Reservations ────────────────────────────────────────────
export const reservationsApi = {
  list: (params?: any) => api.get('/api/inventory/reservations/', { params }),
  get: (id: number) => api.get(`/api/inventory/reservations/${id}/`),
  create: (data: any) => api.post('/api/inventory/reservations/', data),
  fulfill: (id: number, quantity?: number) =>
    api.post(`/api/inventory/reservations/${id}/fulfill/`, { quantity }),
  cancel: (id: number) => api.post(`/api/inventory/reservations/${id}/cancel/`),
}

// ─── Stock Balance ───────────────────────────────────────────
export const stockBalanceApi = {
  get: (productCode: string, warehouseId?: number) =>
    api.get('/api/inventory/stock/', { params: { product_code: productCode, warehouse_id: warehouseId } }),
  lowStock: (warehouseId?: number) =>
    api.get('/api/inventory/stock/low/', { params: { warehouse_id: warehouseId } }),
}

// ─── Inventory Summary ───────────────────────────────────────
export const inventorySummaryApi = {
  get: () => api.get('/api/inventory/summary/'),
}
