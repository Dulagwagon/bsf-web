import { api } from './client';

export const pipelineApi = {
  executar:  (planoId)         => api.post(`/pipeline/executar/${planoId}`),
  atualizar: (planoId)         => api.post(`/pipeline/atualizar/${planoId}`),
  parar:     (planoId)         => api.post(`/pipeline/parar/${planoId}`),
  logs:      (planoId, desde)  => api.get(`/pipeline/logs/${planoId}?desde=${desde ?? 0}`),
  status:    (planoId)         => api.get(`/pipeline/status/${planoId}`),
};