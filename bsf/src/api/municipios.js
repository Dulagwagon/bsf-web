import { api } from './client';

export const municipiosApi = {
  list:        (estado)         => api.get(estado ? `/municipios?estado=${estado}` : '/municipios'),
  create:      (payload)        => api.post('/municipios', payload),
  update:      (id, payload)    => api.put(`/municipios/${id}`, payload),
  remove:      (id)             => api.delete(`/municipios/${id}`),
  importBatch: (list)           => api.post('/municipios/import', list),
};