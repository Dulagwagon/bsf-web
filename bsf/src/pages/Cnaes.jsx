import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styles from './Cnaes.module.css';
import { cnaesApi } from '../api/cnaes';

/* ─── helpers ────────────────────────────────────────────── */
const normalizeCodigo = (raw) => raw.replace(/\D/g, '');

const CODIGO_RE = /^\d{7}$/;

const SECOES = [
  { value: 'A', label: 'A — Agricultura, pecuária, produção florestal, pesca' },
  { value: 'B', label: 'B — Indústrias extrativas' },
  { value: 'C', label: 'C — Indústrias de transformação' },
  { value: 'D', label: 'D — Eletricidade e gás' },
  { value: 'E', label: 'E — Água, esgoto, gestão de resíduos' },
  { value: 'F', label: 'F — Construção' },
  { value: 'G', label: 'G — Comércio, reparação de veículos' },
  { value: 'H', label: 'H — Transporte, armazenagem e correio' },
  { value: 'I', label: 'I — Alojamento e alimentação' },
  { value: 'J', label: 'J — Informação e comunicação' },
  { value: 'K', label: 'K — Atividades financeiras e de seguros' },
  { value: 'L', label: 'L — Atividades imobiliárias' },
  { value: 'M', label: 'M — Atividades profissionais e técnicas' },
  { value: 'N', label: 'N — Atividades administrativas' },
  { value: 'O', label: 'O — Administração pública' },
  { value: 'P', label: 'P — Educação' },
  { value: 'Q', label: 'Q — Saúde humana e serviços sociais' },
  { value: 'R', label: 'R — Artes, cultura, esporte e recreação' },
  { value: 'S', label: 'S — Outras atividades de serviços' },
];

const EMPTY_FORM = { codigo: '', descricao: '', secao: '' };

/* ─── export (download local) ───────────────────────────── */
const exportJSON = (data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cnaes_bsf.json'; a.click();
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
export default function Cnaes() {
  const [cnaes, setCnaes]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [search, setSearch]             = useState('');
  const [secaoFilter, setSecaoFilter]   = useState('');
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
  const loadCnaes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await cnaesApi.list();
      setCnaes(data);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCnaes(); }, [loadCnaes]);

  const filtered = useMemo(() => {
    let list = cnaes;
    if (secaoFilter) list = list.filter(c => c.secao === secaoFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.codigo.includes(q) || c.descricao.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [cnaes, search, secaoFilter]);

  const openItem = (item) => {
    setSelectedId(item.id);
    setIsNew(false);
    setForm({ codigo: item.codigo, descricao: item.descricao, secao: item.secao });
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
    const codigoNorm = normalizeCodigo(form.codigo);
    if (!codigoNorm || !CODIGO_RE.test(codigoNorm)) {
      setError('Código inválido. Use 7 dígitos numéricos, sem máscara (ex: 6201501).');
      return;
    }
    if (!form.descricao.trim()) {
      setError('Descrição é obrigatória.');
      return;
    }

    const payload = { codigo: codigoNorm, descricao: form.descricao.trim(), secao: form.secao };
    setSaving(true);
    setError('');

    try {
      if (isNew) {
        const novo = await cnaesApi.create(payload);
        setCnaes(prev => [...prev, novo]);
        setSelectedId(novo.id);
        setIsNew(false);
        showToast(`CNAE ${codigoNorm} cadastrado e salvo`);
      } else {
        const atualizado = await cnaesApi.update(selectedId, payload);
        setCnaes(prev => prev.map(c => c.id === selectedId ? atualizado : c));
        showToast(`CNAE ${codigoNorm} atualizado e salvo`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id) => setDeleteTarget(id);

  const handleDelete = async () => {
    const item = cnaes.find(c => c.id === deleteTarget);
    setDeleting(true);
    try {
      await cnaesApi.remove(deleteTarget);
      setCnaes(prev => prev.filter(c => c.id !== deleteTarget));
      if (selectedId === deleteTarget) closeForm();
      if (item) showToast(`CNAE ${item.codigo} removido`, 'error');
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
        const summary = await cnaesApi.importBatch(data);
        await loadCnaes();
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
          <span className={styles.topbarTitle}>CNAEs</span>
          <span className={styles.topbarSub}>Catálogo de classificações utilizadas nos planos</span>
        </div>
        <div className={styles.topbarActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
          <button className={styles.exportBtn} onClick={() => fileInputRef.current?.click()} title="Importar CNAEs de um arquivo JSON">
            <i className="ti ti-upload" aria-hidden="true" /> Importar JSON
          </button>
          <button className={styles.exportBtn} onClick={() => exportJSON(cnaes)} title="Exportar catálogo como JSON">
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
                placeholder="Buscar por código ou descrição..."
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
              <i className="ti ti-plus" aria-hidden="true" /> Novo CNAE
            </button>
          </div>

          <div className={styles.filterRow}>
            <div className={styles.selectWrap}>
              <select className={styles.filterSelect} value={secaoFilter} onChange={e => setSecaoFilter(e.target.value)}>
                <option value="">Todas as seções</option>
                {SECOES.map(s => <option key={s.value} value={s.value}>{s.value} — {s.label.split('— ')[1]}</option>)}
              </select>
              <i className="ti ti-chevron-down" aria-hidden="true" />
            </div>
            <span className={styles.listCount}>
              {loading ? 'Carregando...' : `${filtered.length} CNAE${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          <div className={styles.list}>
            {loadError ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{loadError}</span>
                <button className={styles.btnCancel} onClick={loadCnaes} style={{ marginTop: 8 }}>
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
                <i className="ti ti-file-off" aria-hidden="true" />
                <span>Nenhum CNAE encontrado</span>
              </div>
            ) : filtered.map(item => (
              <div
                key={item.id}
                className={`${styles.row} ${selectedId === item.id && !isNew ? styles.rowActive : ''}`}
                onClick={() => openItem(item)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openItem(item)}
              >
                <div className={styles.rowCodigo}>{item.codigo}</div>
                <div className={styles.rowInfo}>
                  <div className={styles.rowDesc}>{item.descricao}</div>
                  {item.secao && <span className={styles.secaoTag}>Seção {item.secao}</span>}
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.rowBtn} onClick={e => { e.stopPropagation(); openItem(item); }} title="Editar" aria-label={`Editar ${item.codigo}`}>
                    <i className="ti ti-pencil" aria-hidden="true" />
                  </button>
                  <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`} onClick={e => { e.stopPropagation(); confirmDelete(item.id); }} title="Excluir" aria-label={`Excluir ${item.codigo}`}>
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
              <i className="ti ti-building" aria-hidden="true" />
              <span>Selecione um CNAE para editar<br />ou cadastre um novo</span>
              <button className={styles.btnNew} onClick={openNew}>
                <i className="ti ti-plus" aria-hidden="true" /> Novo CNAE
              </button>
            </div>
          ) : (
            <div className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <div>
                  <span className={styles.formCardLabel}>{isNew ? 'Novo CNAE' : 'Editar CNAE'}</span>
                  <h2 className={styles.formCardTitle}>{form.codigo || 'Sem código'}</h2>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="f-codigo">Código CNAE</label>
                <input
                  id="f-codigo"
                  className={styles.fieldInput}
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="Ex: 6201501"
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: normalizeCodigo(e.target.value) }))}
                />
                <span className={styles.fieldHint}>7 dígitos numéricos, sem máscara</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="f-descricao">Descrição</label>
                <textarea
                  id="f-descricao"
                  className={styles.fieldTextarea}
                  placeholder="Descrição da atividade econômica"
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="f-secao">Seção (opcional)</label>
                <div className={styles.selectWrap}>
                  <select
                    id="f-secao"
                    className={styles.fieldSelect}
                    value={form.secao}
                    onChange={e => setForm(f => ({ ...f, secao: e.target.value }))}
                  >
                    <option value="">Sem seção definida</option>
                    {SECOES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <i className="ti ti-chevron-down" aria-hidden="true" />
                </div>
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
                  {saving ? 'Salvando...' : (isNew ? 'Cadastrar CNAE' : 'Salvar alterações')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Excluir o CNAE "${cnaes.find(c => c.id === deleteTarget)?.codigo}"? Planos que o utilizam não serão afetados automaticamente.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
