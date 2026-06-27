import { api, API_URL } from './client';

export const resultadosApi = {
  list: (nomePlano) => api.get(`/resultados?plano=${encodeURIComponent(nomePlano)}`),

  // Monta a URL de download direta — usada em <a href> em vez de fetch,
  // já que é o navegador que deve baixar o arquivo.
  downloadUrl: (nomePlano, arquivo) =>
    `${API_URL}/resultados/download?plano=${encodeURIComponent(nomePlano)}&arquivo=${encodeURIComponent(arquivo)}`,

  // Upload de arquivo (ex: dados_setor.csv) — usa FormData/multipart,
  // por isso não passa pelo helper genérico api.post (que força JSON).
  async upload(nomePlano, arquivo, file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(
      `${API_URL}/resultados/upload?plano=${encodeURIComponent(nomePlano)}&arquivo=${encodeURIComponent(arquivo)}`,
      { method: 'POST', body: formData }
    );

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error || `Erro ${res.status} ao enviar o arquivo.`);
    }
    return data;
  },
};