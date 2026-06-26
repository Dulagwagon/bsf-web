import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './Fontes.module.css';
import { fontesApi } from '../api/fontes';

/* ─── helpers ────────────────────────────────────────────── */
const fmtBytes = (bytes) => {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const fmtDate = (epochSeconds) => {
  if (!epochSeconds) return '—';
  return new Date(epochSeconds * 1000).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const chaveItem = (item) =>
  item.tipo === 'rais' ? `rais:${item.regiao}:${item.ano}` : `caged:${item.ano}:${item.mes.toString().padStart(2, '0')}`;

/* ─── confirm modal (exclusão irreversível) ─────────────── */
function ConfirmModal({ message, onConfirm, onCancel, loading }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalIcon}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
        <p className={styles.modalMsg}>{message}</p>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className={styles.modalConfirm} onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── toast ──────────────────────────────────────────────── */
function Toast({ message, type = 'success' }) {
  return (
    <div className={`${styles.toast} ${styles['toast_' + type]}`}>
      <i className={`ti ${type === 'success' ? 'ti-check' : 'ti-alert-triangle'}`} aria-hidden="true" />
      {message}
    </div>
  );
}

/* ─── linha de um arquivo (RAIS ou CAGED) ───────────────── */
function FonteRow({ item, onUpload, onConverter, onExcluirTxt, conversaoAtiva }) {
  const fileInputRef = useRef(null);
  const temTxt = !!item.txt;
  const temParquet = !!item.parquet;

  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{item.label}</div>

      <div className={styles.rowStatus}>
        <span className={`${styles.fileTag} ${temTxt ? styles.fileTagActive : styles.fileTagMissing}`}>
          <i className="ti ti-file-text" aria-hidden="true" /> TXT
          {temTxt && <span className={styles.fileSize}>{fmtBytes(item.txt.tamanho)}</span>}
        </span>
        <span className={`${styles.fileTag} ${temParquet ? styles.fileTagActive : styles.fileTagMissing}`}>
          <i className="ti ti-bolt" aria-hidden="true" /> Parquet
          {temParquet && <span className={styles.fileSize}>{fmtBytes(item.parquet.tamanho)}</span>}
        </span>
      </div>

      <div className={styles.rowActions}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onUpload(item, file);
            e.target.value = '';
          }}
        />
        <button className={styles.rowBtn} onClick={() => fileInputRef.current?.click()} title="Enviar arquivo .txt">
          <i className="ti ti-upload" aria-hidden="true" />
        </button>
        <button
          className={styles.rowBtn}
          onClick={() => onConverter(item)}
          disabled={!temTxt || conversaoAtiva}
          title={temTxt ? 'Converter para Parquet' : 'Envie o .txt primeiro'}
        >
          <i className={`ti ${conversaoAtiva ? 'ti-loader-2' : 'ti-bolt'}`} aria-hidden="true" />
        </button>
        <button
          className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
          onClick={() => onExcluirTxt(item)}
          disabled={!temTxt}
          title="Excluir .txt original"
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ─── modal de upload com progresso ─────────────────────── */
function UploadModal({ item, progress, onCancel }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalIconUpload}><i className="ti ti-cloud-upload" aria-hidden="true" /></div>
        <p className={styles.modalMsg}>Enviando {item.label}...</p>
        <div className={styles.uploadBar}>
          <div className={styles.uploadBarFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.uploadPct}>{progress}%</span>
        {progress < 100 && (
          <button className={styles.modalCancel} onClick={onCancel} style={{ marginTop: 8 }}>Cancelar</button>
        )}
      </div>
    </div>
  );
}

/* ─── modal de conversão com checkbox + logs ────────────── */
function ConverterModal({ item, logs, rodando, erro, apagarOriginal, onToggleApagar, onIniciar, onFechar, onConfirmarApagar }) {
  const [pedirConfirmacao, setPedirConfirmacao] = useState(false);

  const handleToggle = (checked) => {
    if (checked) setPedirConfirmacao(true);
    else onToggleApagar(false);
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalWide}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Converter para Parquet</h3>
          <button className={styles.modalClose} onClick={onFechar}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        <p className={styles.modalSub}>{item.label}</p>

        {!rodando && logs.length === 0 && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={apagarOriginal}
              onChange={e => handleToggle(e.target.checked)}
            />
            Excluir o arquivo .txt original após a conversão
          </label>
        )}

        {logs.length > 0 && (
          <div className={styles.convLogArea}>
            {logs.map((l, i) => (
              <div key={i} className={styles.convLogLine}>{l.msg}</div>
            ))}
            {rodando && <div className={styles.convLogLine}>...</div>}
          </div>
        )}

        {erro && (
          <div className={styles.formError}>
            <i className="ti ti-alert-circle" aria-hidden="true" /> {erro}
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onFechar} disabled={rodando}>
            {logs.length > 0 && !rodando ? 'Fechar' : 'Cancelar'}
          </button>
          {logs.length === 0 && (
            <button className={styles.modalConfirm} onClick={onIniciar} disabled={rodando}>
              {rodando ? 'Convertendo...' : 'Iniciar conversão'}
            </button>
          )}
        </div>

        {pedirConfirmacao && (
          <div className={styles.innerOverlay}>
            <div className={styles.innerModal}>
              <div className={styles.modalIcon}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
              <p className={styles.modalMsg}>
                Isso vai excluir o arquivo .txt original permanentemente após a conversão.
                Esta ação não pode ser desfeita.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.modalCancel} onClick={() => setPedirConfirmacao(false)}>Cancelar</button>
                <button
                  className={styles.modalConfirm}
                  onClick={() => { onToggleApagar(true); setPedirConfirmacao(false); }}
                >
                  Entendo, continuar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────── */
export default function Fontes() {
  const [fontes, setFontes] = useState({ rais: [], caged: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [toast, setToast] = useState(null);

  const [uploadAtivo, setUploadAtivo] = useState(null); // { item, progress }
  const [converterItem, setConverterItem] = useState(null);
  const [converterLogs, setConverterLogs] = useState([]);
  const [converterRodando, setConverterRodando] = useState(false);
  const [converterErro, setConverterErro] = useState(null);
  const [apagarOriginal, setApagarOriginal] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFontes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fontesApi.list();
      setFontes(data);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFontes(); }, [loadFontes]);

  const anosDisponiveis = [...new Set([
    ...fontes.rais.map(f => f.ano),
    ...fontes.caged.map(f => f.ano),
  ])].sort();

  const raisFiltrado = filtroAno ? fontes.rais.filter(f => String(f.ano) === filtroAno) : fontes.rais;
  const cagedFiltrado = filtroAno ? fontes.caged.filter(f => String(f.ano) === filtroAno) : fontes.caged;

  /* ── upload ── */
  const handleUpload = async (item, file) => {
    setUploadAtivo({ item, progress: 0 });
    try {
      const meta = item.tipo === 'rais'
        ? { regiao: item.regiao, ano: item.ano }
        : { ano: item.ano, mes: item.mes };

      await fontesApi.upload(item.tipo, meta, file, (pct) => {
        setUploadAtivo(prev => prev ? { ...prev, progress: pct } : prev);
      });

      showToast(`${item.label}: arquivo enviado com sucesso`);
      await loadFontes();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setUploadAtivo(null);
    }
  };

  /* ── conversão ── */
  const abrirConverter = (item) => {
    setConverterItem(item);
    setConverterLogs([]);
    setConverterRodando(false);
    setConverterErro(null);
    setApagarOriginal(false);
  };

  const fecharConverter = () => {
    setConverterItem(null);
    loadFontes();
  };

  const pollConversao = useCallback(async (chave, cursor) => {
    try {
      const r = await fontesApi.logsConversao(chave, cursor);
      if (r.logs.length > 0) setConverterLogs(prev => [...prev, ...r.logs]);
      if (r.erro) setConverterErro(r.erro);
      setConverterRodando(r.rodando);

      if (r.rodando) {
        setTimeout(() => pollConversao(chave, r.total), 1000);
      }
    } catch {
      setTimeout(() => pollConversao(chave, cursor), 1500);
    }
  }, []);

  const iniciarConversao = async () => {
    if (!converterItem) return;
    setConverterRodando(true);
    setConverterErro(null);
    try {
      const resultado = converterItem.tipo === 'rais'
        ? await fontesApi.converterRais(converterItem.regiao, converterItem.ano, apagarOriginal)
        : await fontesApi.converterCaged(converterItem.ano, converterItem.mes, apagarOriginal);

      pollConversao(resultado.chave, 0);
    } catch (e) {
      setConverterErro(e.message);
      setConverterRodando(false);
    }
  };

  /* ── exclusão de .txt ── */
  const handleExcluirTxt = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.tipo === 'rais') {
        await fontesApi.excluirTxtRais(deleteTarget.regiao, deleteTarget.ano);
      } else {
        await fontesApi.excluirTxtCaged(deleteTarget.ano, deleteTarget.mes);
      }
      showToast(`${deleteTarget.label}: arquivo .txt excluído`, 'error');
      await loadFontes();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Fontes</span>
          <span className={styles.topbarSub}>Arquivos RAIS e CAGED — upload, conversão para Parquet e gestão</span>
        </div>
        <div className={styles.selectWrap}>
          <select className={styles.filterSelect} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="">Todos os anos</option>
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
          <i className="ti ti-chevron-down" aria-hidden="true" />
        </div>
      </header>

      <div className={styles.content}>
        {loadError ? (
          <div className={styles.emptyState}>
            <i className="ti ti-plug-connected-x" aria-hidden="true" />
            <span>{loadError}</span>
            <button className={styles.btnSecondary} onClick={loadFontes}>
              <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className={styles.emptyState}>
            <i className="ti ti-loader-2" aria-hidden="true" />
            <span>Carregando fontes...</span>
          </div>
        ) : (
          <>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>RAIS — por região e ano</span>
                <span className={styles.cardCount}>{raisFiltrado.length} arquivo(s)</span>
              </div>
              <div className={styles.list}>
                {raisFiltrado.map(item => (
                  <FonteRow
                    key={chaveItem(item)}
                    item={item}
                    onUpload={handleUpload}
                    onConverter={abrirConverter}
                    onExcluirTxt={setDeleteTarget}
                    conversaoAtiva={false}
                  />
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>CAGED — por ano e mês</span>
                <span className={styles.cardCount}>{cagedFiltrado.length} arquivo(s)</span>
              </div>
              <div className={styles.list}>
                {cagedFiltrado.map(item => (
                  <FonteRow
                    key={chaveItem(item)}
                    item={item}
                    onUpload={handleUpload}
                    onConverter={abrirConverter}
                    onExcluirTxt={setDeleteTarget}
                    conversaoAtiva={false}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {uploadAtivo && (
        <UploadModal
          item={uploadAtivo.item}
          progress={uploadAtivo.progress}
          onCancel={() => setUploadAtivo(null)}
        />
      )}

      {converterItem && (
        <ConverterModal
          item={converterItem}
          logs={converterLogs}
          rodando={converterRodando}
          erro={converterErro}
          apagarOriginal={apagarOriginal}
          onToggleApagar={setApagarOriginal}
          onIniciar={iniciarConversao}
          onFechar={fecharConverter}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Excluir permanentemente o arquivo .txt de "${deleteTarget.label}"? Esta ação não pode ser desfeita. Certifique-se de que já existe um .parquet equivalente, se necessário.`}
          onConfirm={handleExcluirTxt}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}