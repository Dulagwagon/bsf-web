import { api } from './client';

export const paineisApi = {
  get: (planoId) => api.get(`/paineis/${planoId}`),
};