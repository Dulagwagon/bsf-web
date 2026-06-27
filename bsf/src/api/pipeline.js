import { api } from './client';

export const pipelineApi = {
  executar:  (planoId)         => api.post(`/pipeline/executar/${planoId}`),
  atualizar: (planoId)         => api.post(`/pipeline/atualizar/${planoId}`),
  parar:     (planoId)         => api.post(`/pipeline/parar/${planoId}`),
  logs:      (planoId, desde)  => api.get(`/pipeline/logs/${planoId}?desde=${desde ?? 0}`),
  status:    (planoId)         => api.get(`/pipeline/status/${planoId}`),
  historico: (opts = {})       => {
    const params = new URLSearchParams();
    if (opts.plano) params.set('plano', opts.plano);
    if (opts.limite) params.set('limite', opts.limite);
    const qs = params.toString();
    return api.get(`/pipeline/historico${qs ? `?${qs}` : ''}`);
  },
};