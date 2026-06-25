import { api, API_URL } from './client';

export const resultadosApi = {
  list: (nomePlano) => api.get(`/resultados?plano=${encodeURIComponent(nomePlano)}`),

  // Monta a URL de download direta — usada em <a href> em vez de fetch,
  // já que é o navegador que deve baixar o arquivo.
  downloadUrl: (nomePlano, arquivo) =>
    `${API_URL}/resultados/download?plano=${encodeURIComponent(nomePlano)}&arquivo=${encodeURIComponent(arquivo)}`,
};