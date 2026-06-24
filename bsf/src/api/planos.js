import { api } from './client';

export const planosApi = {
  list:         ()              => api.get('/planos'),
  create:       (payload)       => api.post('/planos', payload),
  update:       (id, payload)   => api.put(`/planos/${id}`, payload),
  remove:       (id)            => api.delete(`/planos/${id}`),
  updateStatus: (id, status)    => api.patch(`/planos/${id}/status`, { status }),
};