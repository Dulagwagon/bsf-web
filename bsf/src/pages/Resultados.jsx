import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Resultados.module.css';
import { planosApi } from '../api/planos';
import { resultadosApi } from '../api/resultados';

/* ─── helpers ────────────────────────────────────────────── */
const fmtBytes = (bytes) => {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (epochSeconds) => {
  if (!epochSeconds) return '—';
  return new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const STATUS_LABEL = { done: 'Concluído', idle: 'Aguardando', error: 'Erro', running: 'Em execução' };

function Toast({ message, type = 'success' }) {
  return (
    <div className={`${styles.toast} ${styles['toast_' + type]}`}>
      <i className={`ti ${type === 'success' ? 'ti-check' : 'ti-alert-triangle'}`} aria-hidden="true" />
      {message}
    </div>
  );
}

const FILE_META = {
  'rais_caged.csv':   { icon: 'ti-file-spreadsheet', desc: 'Base completa, separada por vírgula' },
  'rais_caged_t.csv': { icon: 'ti-file-spreadsheet', desc: 'Base completa, separada por tabulação' },
  'dados_setor.csv':  { icon: 'ti-building-factory-2', desc: 'Uma linha por CNPJ — alimenta a aba Dados do Setor' },
};

/* ─── component ──────────────────────────────────────────── */
export default function Resultados() {
  const [planos, setPlanos]               = useState([]);
  const [loadingPlanos, setLoadingPlanos]  = useState(true);
  const [loadError, setLoadError]          = useState('');

  const [selectedId, setSelectedId]        = useState(null);
  const [arquivos, setArquivos]            = useState([]);
  const [loadingArquivos, setLoadingArquivos] = useState(false);
  const [arquivosError, setArquivosError]  = useState('');
  const [uploading, setUploading]          = useState(false);
  const [toast, setToast]                  = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── carregar planos do backend ── */
  const loadPlanos = useCallback(async () => {
    setLoadingPlanos(true);
    setLoadError('');
    try {
      const data = await planosApi.list();
      setPlanos(data);
      if (data.length > 0) {
        setSelectedId(prev => prev ?? data[0].id);
      }
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoadingPlanos(false);
    }
  }, []);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);

  const plano = planos.find(p => p.id === selectedId);

  /* ── carregar arquivos disponíveis para o plano selecionado ── */
  const loadArquivos = useCallback(async (nomePlano) => {
    if (!nomePlano) { setArquivos([]); return; }
    setLoadingArquivos(true);
    setArquivosError('');
    try {
      const data = await resultadosApi.list(nomePlano);
      setArquivos(data);
    } catch (e) {
      setArquivosError(e.message);
    } finally {
      setLoadingArquivos(false);
    }
  }, []);

  useEffect(() => {
    if (plano) loadArquivos(plano.nome);
  }, [plano, loadArquivos]);

  const handleUploadDadosSetor = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !plano) return;

    setUploading(true);
    try {
      await resultadosApi.upload(plano.nome, 'dados_setor.csv', file);
      showToast('Arquivo de dados do setor enviado com sucesso.');
      await loadArquivos(plano.nome);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* TOPBAR */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Resultados</span>
          <span className={styles.topbarSub}>Arquivos gerados pela execução do pipeline</span>
        </div>
      </header>

      <div className={styles.content}>
        {/* ── LEFT: seletor + info do plano ── */}
        <div className={styles.left}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Selecionar plano</span>
            </div>

            {loadError ? (
              <div className={styles.emptyMini}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{loadError}</span>
                <button className={styles.btnSecondary} onClick={loadPlanos} style={{ marginTop: 8 }}>
                  <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            ) : loadingPlanos ? (
              <div className={styles.emptyMini}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>Carregando planos...</span>
              </div>
            ) : planos.length === 0 ? (
              <div className={styles.emptyMini}>
                <i className="ti ti-file-off" aria-hidden="true" />
                <span>Nenhum plano cadastrado. Crie um em <strong>Planos</strong> no menu lateral.</span>
              </div>
            ) : (
              <>
                <label className={styles.label} htmlFor="plano-select">Plano</label>
                <div className={styles.selectWrap}>
                  <select
                    id="plano-select"
                    className={styles.select}
                    value={selectedId ?? ''}
                    onChange={e => setSelectedId(Number(e.target.value))}
                  >
                    {planos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <i className="ti ti-chevron-down" aria-hidden="true" />
                </div>
              </>
            )}
          </div>

          {plano && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Dados do plano</span>
                <span className={`${styles.statusBadge} ${styles['status_' + plano.status]}`}>
                  {STATUS_LABEL[plano.status] ?? 'Aguardando'}
                </span>
              </div>

              <div className={styles.planName}>{plano.nome}</div>
              <div className={styles.planState}>
                <i className="ti ti-map-pin" aria-hidden="true" />
                {plano.estado || '—'}{plano.regiao ? ` · ${plano.regiao}` : ''}
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CNAEs</span>
                  <span className={styles.infoVal}>{plano.cnaes.length}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Municípios</span>
                  <span className={styles.infoVal}>{plano.municipios.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: arquivos disponíveis ── */}
        <div className={styles.right}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Arquivos disponíveis</span>
              <div className={styles.cardHeaderActions}>
                {plano && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleUploadDadosSetor}
                    />
                    <button
                      className={styles.uploadBtn}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Enviar dados_setor.csv (uma linha por CNPJ, para a aba Dados do Setor)"
                    >
                      <i className={`ti ${uploading ? 'ti-loader-2' : 'ti-upload'}`} aria-hidden="true" />
                      {uploading ? 'Enviando...' : 'Enviar dados do setor'}
                    </button>
                  </>
                )}
                {arquivos.length > 0 && (
                  <button className={styles.refreshBtn} onClick={() => loadArquivos(plano.nome)} title="Atualizar lista">
                    <i className="ti ti-refresh" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {!plano ? (
              <div className={styles.emptyState}>
                <i className="ti ti-folder-open" aria-hidden="true" />
                <span>Selecione um plano para ver os resultados disponíveis</span>
              </div>
            ) : arquivosError ? (
              <div className={styles.emptyState}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{arquivosError}</span>
                <button className={styles.btnSecondary} onClick={() => loadArquivos(plano.nome)} style={{ marginTop: 8 }}>
                  <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            ) : loadingArquivos ? (
              <div className={styles.emptyState}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>Verificando arquivos gerados...</span>
              </div>
            ) : arquivos.length === 0 ? (
              <div className={styles.emptyState}>
                <i className="ti ti-file-off" aria-hidden="true" />
                <span>
                  Nenhum arquivo disponível ainda para <strong>{plano.nome}</strong>.<br />
                  Execute o pipeline na tela <strong>Pipeline</strong> para gerar os resultados.
                </span>
              </div>
            ) : (
              <div className={styles.fileList}>
                {arquivos.map(arq => {
                  const meta = FILE_META[arq.nome] ?? { icon: 'ti-file', desc: '' };
                  return (
                    <div key={arq.nome} className={styles.fileRow}>
                      <div className={styles.fileIcon}>
                        <i className={`ti ${meta.icon}`} aria-hidden="true" />
                      </div>
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{arq.nome}</div>
                        <div className={styles.fileMeta}>
                          {meta.desc && <span>{meta.desc}</span>}
                          <span>{fmtBytes(arq.tamanho)}</span>
                          <span>Gerado em {fmtDate(arq.modificadoEm)}</span>
                        </div>
                      </div>
                      <a
                        className={styles.downloadBtn}
                        href={resultadosApi.downloadUrl(plano.nome, arq.nome)}
                        download={arq.nome}
                      >
                        <i className="ti ti-download" aria-hidden="true" /> Baixar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}