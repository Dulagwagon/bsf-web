import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styles from './Municipios.module.css';
import { municipiosApi } from '../api/municipios';

/* ─── helpers ────────────────────────────────────────────── */
const normalizeCodigo = (raw) => {
  const d = raw.replace(/\D/g, '');
  // aceita 7 dígitos (com verificador) e descarta o último
  return d.length === 7 ? d.slice(0, 6) : d;
};

const CODIGO_RE = /^\d{6}$/;
const UF_RE = /^[A-Z]{2}$/;

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

const EMPTY_FORM = { estado: '', nome: '', codigo: '' };

/* ─── export (download local) ───────────────────────────── */
const exportJSON = (data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'municipios_bsf.json'; a.click();
  URL.revokeObjectURL(url);
};

/* ─── confirm modal ──────────────────────────────────────── */
function ConfirmModal({ message, onConfirm, onCancel, loading }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalIcon}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
        <p className={styles.modalMsg}>{message}</p>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className={styles.modalConfirm} onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir'}
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

/* ─── main ───────────────────────────────────────────────── */
export default function Municipios() {
  const [municipios, setMunicipios]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [search, setSearch]             = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [isNew, setIsNew]               = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [error, setError]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  /* ── carregar do backend ── */
  const loadMunicipios = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await municipiosApi.list();
      setMunicipios(data);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMunicipios(); }, [loadMunicipios]);

  const filtered = useMemo(() => {
    let list = municipios;
    if (estadoFilter) list = list.filter(m => m.estado === estadoFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.nome.toLowerCase().includes(q) || m.codigo.includes(q));
    }
    return [...list].sort((a, b) => a.estado.localeCompare(b.estado) || a.nome.localeCompare(b.nome));
  }, [municipios, search, estadoFilter]);

  const openItem = (item) => {
    setSelectedId(item.id);
    setIsNew(false);
    setForm({ estado: item.estado, nome: item.nome, codigo: item.codigo });
    setError('');
  };

  const openNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setError('');
  };

  const closeForm = () => { setSelectedId(null); setIsNew(false); setError(''); };

  const handleSave = async () => {
    const estadoNorm = form.estado.trim().toUpperCase();
    const codigoNorm = normalizeCodigo(form.codigo);

    if (!UF_RE.test(estadoNorm) || !UFS.includes(estadoNorm)) {
      setError('Estado (UF) inválido. Use a sigla com 2 letras (ex: SP).');
      return;
    }
    if (!form.nome.trim()) {
      setError('Nome do município é obrigatório.');
      return;
    }
    if (!CODIGO_RE.test(codigoNorm)) {
      setError('Código IBGE inválido. Use 6 dígitos numéricos, sem o dígito verificador (ex: 355030).');
      return;
    }

    const payload = { estado: estadoNorm, nome: form.nome.trim(), codigo: codigoNorm };
    setSaving(true);
    setError('');

    try {
      if (isNew) {
        const novo = await municipiosApi.create(payload);
        setMunicipios(prev => [...prev, novo]);
        setSelectedId(novo.id);
        setIsNew(false);
        showToast(`${novo.nome} (${novo.estado}) cadastrado e salvo`);
      } else {
        const atualizado = await municipiosApi.update(selectedId, payload);
        setMunicipios(prev => prev.map(m => m.id === selectedId ? atualizado : m));
        showToast(`${atualizado.nome} (${atualizado.estado}) atualizado e salvo`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id) => setDeleteTarget(id);

  const handleDelete = async () => {
    const item = municipios.find(m => m.id === deleteTarget);
    setDeleting(true);
    try {
      await municipiosApi.remove(deleteTarget);
      setMunicipios(prev => prev.filter(m => m.id !== deleteTarget));
      if (selectedId === deleteTarget) closeForm();
      if (item) showToast(`${item.nome} (${item.estado}) removido`, 'error');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Formato inválido');
        const summary = await municipiosApi.importBatch(data);
        await loadMunicipios();
        showToast(`${summary.added} importado(s), ${summary.skipped} ignorado(s)`);
      } catch (err) {
        showToast(err.message || 'Arquivo JSON inválido', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={styles.page}>
      {/* TOPBAR */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Municípios</span>
          <span className={styles.topbarSub}>Catálogo de estados e municípios utilizados nos planos</span>
        </div>
        <div className={styles.topbarActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button className={styles.exportBtn} onClick={() => fileInputRef.current?.click()} title="Importar municípios de um arquivo JSON">
            <i className="ti ti-upload" aria-hidden="true" /> Importar JSON
          </button>
          <button className={styles.exportBtn} onClick={() => exportJSON(municipios)} title="Exportar catálogo como JSON">
            <i className="ti ti-download" aria-hidden="true" /> Exportar JSON
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* ── LEFT: lista ── */}
        <div className={styles.left}>
          <div className={styles.listHeader}>
            <div className={styles.searchWrap}>
              <i className="ti ti-search" aria-hidden="true" />
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Buscar por nome ou código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className={styles.searchClear} onClick={() => setSearch('')} aria-label="Limpar busca">
                  <i className="ti ti-x" aria-hidden="true" />
                </button>
              )}
            </div>
            <button className={styles.btnNew} onClick={openNew}>
              <i className="ti ti-plus" aria-hidden="true" /> Novo município
            </button>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.selectWrap}>
              <select className={styles.filterSelect} value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
                <option value="">Todos os estados</option>
                {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
              <i className="ti ti-chevron-down" aria-hidden="true" />
            </div>
            <span className={styles.listCount}>
              {loading ? 'Carregando...' : `${filtered.length} município${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className={styles.list}>
            {loadError ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{loadError}</span>
                <button className={styles.btnCancel} onClick={loadMunicipios} style={{ marginTop: 8 }}>
                  <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>Carregando catálogo...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-map-off" aria-hidden="true" />
                <span>Nenhum município encontrado</span>
              </div>
            ) : filtered.map(item => (
              <div
                key={item.id}
                className={`${styles.row} ${selectedId === item.id && !isNew ? styles.rowActive : ''}`}
                onClick={() => openItem(item)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openItem(item)}
              >
                <div className={styles.rowUf}>{item.estado}</div>
                <div className={styles.rowInfo}>
                  <div className={styles.rowNome}>{item.nome}</div>
                  <span className={styles.codigoTag}>{item.codigo}</span>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.rowBtn} onClick={e => { e.stopPropagation(); openItem(item); }} title="Editar" aria-label={`Editar ${item.nome}`}>
                    <i className="ti ti-pencil" aria-hidden="true" />
                  </button>
                  <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`} onClick={e => { e.stopPropagation(); confirmDelete(item.id); }} title="Excluir" aria-label={`Excluir ${item.nome}`}>
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: form ── */}
        <div className={styles.right}>
          {!selectedId && !isNew ? (
            <div className={styles.emptyState}>
              <i className="ti ti-map-pin" aria-hidden="true" />
              <span>Selecione um município para editar<br />ou cadastre um novo</span>
              <button className={styles.btnNew} onClick={openNew}>
                <i className="ti ti-plus" aria-hidden="true" /> Novo município
              </button>
            </div>
          ) : (
            <div className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <div>
                  <span className={styles.formCardLabel}>{isNew ? 'Novo município' : 'Editar município'}</span>
                  <h2 className={styles.formCardTitle}>{form.nome || 'Sem nome'}</h2>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="f-estado">Estado (UF)</label>
                  <div className={styles.selectWrap}>
                    <select
                      id="f-estado"
                      className={styles.fieldSelect}
                      value={form.estado}
                      onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    >
                      <option value="">Selecionar...</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                    <i className="ti ti-chevron-down" aria-hidden="true" />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="f-codigo">Código IBGE</label>
                  <input
                    id="f-codigo"
                    className={styles.fieldInput}
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="Ex: 355030"
                    value={form.codigo}
                    onChange={e => setForm(f => ({ ...f, codigo: normalizeCodigo(e.target.value) }))}
                  />
                </div>
              </div>
              <span className={styles.fieldHint}>6 dígitos numéricos, sem o dígito verificador</span>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="f-nome">Nome do município</label>
                <input
                  id="f-nome"
                  className={styles.fieldInput}
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </div>

              {error && (
                <div className={styles.formError}>
                  <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
                </div>
              )}

              <div className={styles.formFooter}>
                <button className={styles.btnCancel} onClick={closeForm} disabled={saving}>Cancelar</button>
                <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                  <i className={`ti ${saving ? 'ti-loader-2' : 'ti-device-floppy'}`} aria-hidden="true" />
                  {saving ? 'Salvando...' : (isNew ? 'Cadastrar município' : 'Salvar alterações')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Excluir o município "${municipios.find(m => m.id === deleteTarget)?.nome}"? Planos que o utilizam não serão afetados automaticamente.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}