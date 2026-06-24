import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styles from './Planos.module.css';
import { planosApi } from '../api/planos';

/* ─── helpers ────────────────────────────────────────────── */
const IBGE6_RE = /^\d{6}$/;
const CNAE_RE  = /^\d{7}$/;

const normalizeCnae = (raw) => raw.replace(/\D/g, '');

const normalizeIbge = (raw) => {
  const d = raw.replace(/\D/g, '');
  // aceita 6 ou 7 dígitos — se 7, descarta o último (dígito verificador)
  if (d.length === 7) return d.slice(0, 6);
  if (d.length === 6) return d;
  return null;
};

const parseTokens = (text) =>
  text.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);

const STATUS_META = {
  done:    { label: 'Concluído',  cls: 'done'    },
  idle:    { label: 'Aguardando', cls: 'idle'    },
  error:   { label: 'Erro',       cls: 'error'   },
  running: { label: 'Executando', cls: 'running' },
};

const REGIOES   = ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
const EMPTY_FORM = { nome: '', regiao: '', estado: '', cnaes: [], municipios: [] };

/* ─── tag input ──────────────────────────────────────────── */
function TagInput({ tags, onAdd, onRemove, placeholder, validate, normalize, hint }) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const tryAdd = (text) => {
    const tokens = parseTokens(text);
    const valid = [], invalid = [];
    tokens.forEach(t => {
      const n = normalize ? normalize(t) : t.trim();
      if (!n) return;
      if (tags.includes(n)) return; // already added
      if (validate && !validate(n, t)) { invalid.push(t); return; }
      valid.push(n);
    });
    if (valid.length) { onAdd(valid); setRaw(''); setError(''); }
    if (invalid.length) setError(`Inválido: ${invalid.join(', ')}`);
    else if (valid.length) setError('');
  };

  const handleKey = (e) => {
    if (['Enter', ',', ';'].includes(e.key)) {
      e.preventDefault();
      tryAdd(raw);
    }
    if (e.key === 'Backspace' && !raw && tags.length) {
      onRemove(tags[tags.length - 1]);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    tryAdd(e.clipboardData.getData('text'));
  };

  return (
    <div className={styles.tagInput} onClick={() => inputRef.current?.focus()}>
      {tags.map(tag => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button type="button" onClick={() => onRemove(tag)} aria-label={`Remover ${tag}`}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className={styles.tagInputField}
        value={raw}
        onChange={e => { setRaw(e.target.value); setError(''); }}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        onBlur={() => raw.trim() && tryAdd(raw)}
        placeholder={tags.length === 0 ? placeholder : ''}
      />
      {error && <span className={styles.tagError}>{error}</span>}
      {hint && !error && <span className={styles.tagHint}>{hint}</span>}
    </div>
  );
}

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

/* ─── export (download local) ───────────────────────────── */
const exportJSON = (planos) => {
  const data = JSON.stringify(planos, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'planos_bsf.json'; a.click();
  URL.revokeObjectURL(url);
};

/* ─── main ───────────────────────────────────────────────── */
export default function Planos() {
  const [planos, setPlanos]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [isNew, setIsNew]               = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [toast, setToast]               = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  /* ── carregar do backend ── */
  const loadPlanos = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await planosApi.list();
      setPlanos(data);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);

  const filtered = useMemo(() =>
    planos.filter(p => p.nome.toLowerCase().includes(search.toLowerCase())),
    [planos, search]
  );

  const openPlano = (plano) => {
    setSelectedId(plano.id);
    setIsNew(false);
    setForm({ nome: plano.nome, regiao: plano.regiao, estado: plano.estado, cnaes: [...plano.cnaes], municipios: [...plano.municipios] });
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
    if (!form.nome.trim()) {
      setError('Nome do plano é obrigatório.');
      return;
    }

    const payload = {
      nome:       form.nome.trim(),
      regiao:     form.regiao,
      estado:     form.estado,
      cnaes:      form.cnaes,
      municipios: form.municipios,
      status:     'idle',
    };

    setSaving(true);
    setError('');

    try {
      if (isNew) {
        const novo = await planosApi.create(payload);
        setPlanos(prev => [...prev, novo]);
        setSelectedId(novo.id);
        setIsNew(false);
        showToast(`Plano "${novo.nome}" criado e salvo`);
      } else {
        const atualizado = await planosApi.update(selectedId, payload);
        setPlanos(prev => prev.map(p => p.id === selectedId ? atualizado : p));
        showToast(`Plano "${atualizado.nome}" atualizado e salvo`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id) => setDeleteTarget(id);

  const handleDelete = async () => {
    const plano = planos.find(p => p.id === deleteTarget);
    setDeleting(true);
    try {
      await planosApi.remove(deleteTarget);
      setPlanos(prev => prev.filter(p => p.id !== deleteTarget));
      if (selectedId === deleteTarget || isNew) closeForm();
      if (plano) showToast(`Plano "${plano.nome}" removido`, 'error');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const addTags  = (field, vals) => setForm(f => ({ ...f, [field]: [...f[field], ...vals] }));
  const removeTag = (field, val) => setForm(f => ({ ...f, [field]: f[field].filter(t => t !== val) }));

  const formValid = form.nome.trim().length > 0;

  return (
    <div className={styles.page}>
      {/* TOPBAR */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Planos</span>
          <span className={styles.topbarSub}>Gerencie combinações de CNAEs e Municípios</span>
        </div>
        <button className={styles.exportBtn} onClick={() => exportJSON(planos)} title="Exportar todos os planos como JSON">
          <i className="ti ti-download" aria-hidden="true" /> Exportar JSON
        </button>
      </header>

      <div className={styles.content}>
        {/* ── LEFT ── */}
        <div className={styles.left}>
          <div className={styles.listHeader}>
            <div className={styles.searchWrap}>
              <i className="ti ti-search" aria-hidden="true" />
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Buscar planos..."
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
              <i className="ti ti-plus" aria-hidden="true" /> Novo plano
            </button>
          </div>

          <div className={styles.listCount}>
            {loading ? 'Carregando...' : `${filtered.length} plano${filtered.length !== 1 ? 's' : ''}`}
            {!loading && search && ` para "${search}"`}
          </div>

          <div className={styles.list}>
            {loadError ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{loadError}</span>
                <button className={styles.btnCancel} onClick={loadPlanos} style={{ marginTop: 8 }}>
                  <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>Carregando planos...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.listEmpty}>
                <i className="ti ti-file-off" aria-hidden="true" />
                <span>Nenhum plano encontrado</span>
              </div>
            ) : filtered.map(plano => (
              <div
                key={plano.id}
                className={`${styles.planRow} ${selectedId === plano.id && !isNew ? styles.planRowActive : ''}`}
                onClick={() => openPlano(plano)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openPlano(plano)}
              >
                <div className={styles.planRowIcon}>
                  <i className="ti ti-file-description" aria-hidden="true" />
                </div>
                <div className={styles.planRowInfo}>
                  <div className={styles.planRowName}>{plano.nome}</div>
                  <div className={styles.planRowMeta}>
                    {plano.estado || '—'} · {plano.cnaes.length} CNAE{plano.cnaes.length !== 1 ? 's' : ''} · {plano.municipios.length} município{plano.municipios.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className={styles.planRowRight}>
                  <span className={`${styles.badge} ${styles['badge_' + (STATUS_META[plano.status]?.cls ?? 'idle')]}`}>
                    {STATUS_META[plano.status]?.label ?? 'Aguardando'}
                  </span>
                  <div className={styles.planRowActions}>
                    <button className={styles.rowBtn} onClick={e => { e.stopPropagation(); openPlano(plano); }} title="Editar" aria-label={`Editar ${plano.nome}`}>
                      <i className="ti ti-pencil" aria-hidden="true" />
                    </button>
                    <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`} onClick={e => { e.stopPropagation(); confirmDelete(plano.id); }} title="Excluir" aria-label={`Excluir ${plano.nome}`}>
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div className={styles.right}>
          {!selectedId && !isNew ? (
            <div className={styles.emptyState}>
              <i className="ti ti-layout-sidebar-right" aria-hidden="true" />
              <span>Selecione um plano para editar<br />ou crie um novo</span>
              <button className={styles.btnNew} onClick={openNew}>
                <i className="ti ti-plus" aria-hidden="true" /> Novo plano
              </button>
            </div>
          ) : (
            <div className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <div>
                  <span className={styles.formCardLabel}>{isNew ? 'Novo plano' : 'Editar plano'}</span>
                  <h2 className={styles.formCardTitle}>{form.nome || 'Sem nome'}</h2>
                </div>
              </div>

              {/* NOME */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="f-nome">Nome do plano</label>
                <input
                  id="f-nome"
                  className={styles.fieldInput}
                  type="text"
                  placeholder="Ex: SP — Tecnologia"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                />
              </div>

              {/* REGIAO + ESTADO */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="f-regiao">Região</label>
                  <div className={styles.selectWrap}>
                    <select id="f-regiao" className={styles.fieldSelect} value={form.regiao}
                      onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))}>
                      <option value="">Selecionar...</option>
                      {REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <i className="ti ti-chevron-down" aria-hidden="true" />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="f-estado">Estado (UF)</label>
                  <input
                    id="f-estado"
                    className={styles.fieldInput}
                    type="text"
                    maxLength={2}
                    placeholder="Ex: SP"
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>

              {/* CNAES */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  CNAEs <span className={styles.fieldSub}>(código — 7 dígitos, sem máscara)</span>
                  <span className={styles.fieldCount}>{form.cnaes.length} adicionado{form.cnaes.length !== 1 ? 's' : ''}</span>
                </label>
                <TagInput
                  tags={form.cnaes}
                  onAdd={vals => addTags('cnaes', vals)}
                  onRemove={val => removeTag('cnaes', val)}
                  placeholder="Digite o código CNAE e pressione Enter ou vírgula..."
                  normalize={normalizeCnae}
                  validate={(n) => CNAE_RE.test(n)}
                  hint="Ex: 6201501 — 7 dígitos, sem máscara"
                />
              </div>

              {/* MUNICÍPIOS */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Municípios <span className={styles.fieldSub}>(código IBGE — 6 dígitos)</span>
                  <span className={styles.fieldCount}>{form.municipios.length} adicionado{form.municipios.length !== 1 ? 's' : ''}</span>
                </label>
                <TagInput
                  tags={form.municipios}
                  onAdd={vals => addTags('municipios', vals)}
                  onRemove={val => removeTag('municipios', val)}
                  placeholder="Digite o código IBGE e pressione Enter ou vírgula..."
                  normalize={normalizeIbge}
                  validate={(n) => IBGE6_RE.test(n)}
                  hint="Ex: 355030 (São Paulo) — 6 dígitos, sem o dígito verificador"
                />
              </div>

              {error && (
                <div className={styles.formError}>
                  <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
                </div>
              )}

              {/* FOOTER */}
              <div className={styles.formFooter}>
                <button className={styles.btnCancel} onClick={closeForm} disabled={saving}>
                  Cancelar
                </button>
                <button
                  className={`${styles.btnSave} ${!formValid ? styles.btnSaveDisabled : ''}`}
                  onClick={handleSave}
                  disabled={!formValid || saving}
                >
                  <i className={`ti ${saving ? 'ti-loader-2' : 'ti-device-floppy'}`} aria-hidden="true" />
                  {saving ? 'Salvando...' : (isNew ? 'Criar plano' : 'Salvar alterações')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Excluir o plano "${planos.find(p => p.id === deleteTarget)?.nome}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}