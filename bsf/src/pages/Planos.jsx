import { useState, useMemo, useRef } from 'react';
import styles from './Planos.module.css';

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

const PLANOS_INICIAIS = [
  { id: 1, nome: 'SP — Tecnologia',  regiao: 'Sudeste',  estado: 'SP', cnaes: ['6201501','6311900'],  municipios: ['355030','350950','354890'], status: 'done'  },
  { id: 2, nome: 'RJ — Varejo',      regiao: 'Sudeste',  estado: 'RJ', cnaes: ['4711301','4712100'],  municipios: ['330455','330490','330227'], status: 'done'  },
  { id: 3, nome: 'MG — Indústria',   regiao: 'Sudeste',  estado: 'MG', cnaes: ['2821601','2941700'],  municipios: ['310620','316700','313670'], status: 'done'  },
  { id: 4, nome: 'PR — Agronegócio', regiao: 'Sul',      estado: 'PR', cnaes: ['0111301','0112101'],  municipios: ['410690','410480','411520'], status: 'idle'  },
  { id: 5, nome: 'BA — Construção',  regiao: 'Nordeste', estado: 'BA', cnaes: ['4120400'],             municipios: ['290570','292740'],         status: 'error' },
];

const STATUS_META = {
  done:    { label: 'Concluído',  cls: 'done'    },
  idle:    { label: 'Aguardando', cls: 'idle'    },
  error:   { label: 'Erro',       cls: 'error'   },
  running: { label: 'Executando', cls: 'running' },
};

const REGIOES   = ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
const EMPTY_FORM = { nome: '', regiao: '', estado: '', cnaes: [], municipios: [] };
const nextId = (list) => Math.max(0, ...list.map(p => p.id)) + 1;

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
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalIcon}><i className="ti ti-alert-triangle" aria-hidden="true" /></div>
        <p className={styles.modalMsg}>{message}</p>
        <div className={styles.modalActions}>
          <button className={styles.modalCancel} onClick={onCancel}>Cancelar</button>
          <button className={styles.modalConfirm} onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

/* ─── export helpers ─────────────────────────────────────── */
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
  const [planos, setPlanos]             = useState(PLANOS_INICIAIS);
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [isNew, setIsNew]               = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saved, setSaved]               = useState(false);

  const filtered = useMemo(() =>
    planos.filter(p => p.nome.toLowerCase().includes(search.toLowerCase())),
    [planos, search]
  );

  const openPlano = (plano) => {
    setSelectedId(plano.id);
    setIsNew(false);
    setForm({ nome: plano.nome, regiao: plano.regiao, estado: plano.estado, cnaes: [...plano.cnaes], municipios: [...plano.municipios] });
    setSaved(false);
  };

  const openNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm(EMPTY_FORM);
    setSaved(false);
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    const payload = {
      nome:       form.nome.trim(),
      regiao:     form.regiao,
      estado:     form.estado,
      cnaes:      form.cnaes,
      municipios: form.municipios,
      status:     'idle',
    };
    if (isNew) {
      const novo = { id: nextId(planos), ...payload };
      setPlanos(prev => [...prev, novo]);
      setSelectedId(novo.id);
      setIsNew(false);
    } else {
      setPlanos(prev => prev.map(p => p.id === selectedId ? { ...p, ...payload } : p));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const confirmDelete = (id) => setDeleteTarget(id);
  const handleDelete = () => {
    setPlanos(prev => prev.filter(p => p.id !== deleteTarget));
    if (selectedId === deleteTarget || isNew) { setSelectedId(null); setIsNew(false); }
    setDeleteTarget(null);
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
            {filtered.length} plano{filtered.length !== 1 ? 's' : ''}
            {search && ` para "${search}"`}
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
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
                {saved && (
                  <span className={styles.savedTag}>
                    <i className="ti ti-check" aria-hidden="true" /> Salvo
                  </span>
                )}
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

              {/* FOOTER */}
              <div className={styles.formFooter}>
                <button className={styles.btnCancel} onClick={() => { setSelectedId(null); setIsNew(false); }}>
                  Cancelar
                </button>
                <button
                  className={`${styles.btnSave} ${!formValid ? styles.btnSaveDisabled : ''}`}
                  onClick={handleSave}
                  disabled={!formValid}
                >
                  <i className="ti ti-device-floppy" aria-hidden="true" />
                  {isNew ? 'Criar plano' : 'Salvar alterações'}
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
        />
      )}
    </div>
  );
}