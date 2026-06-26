import { api, API_URL } from './client';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB por chunk

export const fontesApi = {
  list: () => api.get('/fontes'),

  converterRais: (regiao, ano, apagarOriginal) =>
    api.post(`/fontes/rais/${regiao}/${ano}/converter`, { apagar_original: apagarOriginal }),

  converterCaged: (ano, mes, apagarOriginal) =>
    api.post(`/fontes/caged/${ano}/${mes}/converter`, { apagar_original: apagarOriginal }),

  logsConversao: (chave, desde) =>
    api.get(`/fontes/conversao/${chave}/logs?desde=${desde ?? 0}`),

  excluirTxtRais: (regiao, ano) =>
    api.delete(`/fontes/rais/${regiao}/${ano}/txt`),

  excluirTxtCaged: (ano, mes) =>
    api.delete(`/fontes/caged/${ano}/${mes}/txt`),

  /**
   * Faz upload de um arquivo em chunks, reportando progresso via onProgress(pct).
   * tipo: 'rais' | 'caged'
   * meta: { regiao, ano } para rais, ou { ano, mes } para caged
   */
  async upload(tipo, meta, file, onProgress) {
    const iniciado = await api.post('/fontes/upload/iniciar', { tipo, ...meta });
    const uploadId = iniciado.upload_id;

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);

        const res = await fetch(`${API_URL}/fontes/upload/${uploadId}/chunk`, {
          method: 'POST',
          body: blob,
        });
        if (!res.ok) throw new Error(`Erro ao enviar parte ${i + 1} de ${totalChunks}.`);

        if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      return await api.post(`/fontes/upload/${uploadId}/finalizar`);
    } catch (e) {
      await api.post(`/fontes/upload/${uploadId}/cancelar`).catch(() => {});
      throw e;
    }
  },
};