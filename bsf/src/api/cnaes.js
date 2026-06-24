import { api } from './client';

export const cnaesApi = {
  list:        ()              => api.get('/cnaes'),
  create:      (payload)       => api.post('/cnaes', payload),
  update:      (id, payload)   => api.put(`/cnaes/${id}`, payload),
  remove:      (id)            => api.delete(`/cnaes/${id}`),
  importBatch: (list)          => api.post('/cnaes/import', list),
};
