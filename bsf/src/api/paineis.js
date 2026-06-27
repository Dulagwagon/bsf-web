import { api } from './client';

export const paineisApi = {
  get: (planoId) => api.get(`/paineis/${planoId}`),

  dadosSetor: (planoId, filtros = {}) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor) params.set(chave, valor);
    });
    const qs = params.toString();
    return api.get(`/paineis/${planoId}/dados-setor${qs ? `?${qs}` : ''}`);
  },

  listaCnpj: (planoId) => api.get(`/paineis/${planoId}/lista-cnpj`),

  porte: (planoId) => api.get(`/paineis/${planoId}/porte`),
};