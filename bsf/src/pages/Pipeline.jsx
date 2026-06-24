import { useState, useEffect, useRef } from 'react';
import styles from './Pipeline.module.css';

/* ─── mock data ──────────────────────────────────────────── */
const PLANOS = [
  {
    id: 1,
    nome: 'SP — Tecnologia',
    estado: 'SP',
    cnaes: ['6201501 — Desenvolvimento de programas de computador', '6311900 — Tratamento de dados e hospedagem'],
    municipios: 42,
    registros: 2100,
    ultimaExecucao: '2025-06-08T14:32:00',
    status: 'done',
    duracaoMedia: '4m 12s',
    criadoEm: '2025-03-15',
  },
  {
    id: 2,
    nome: 'RJ — Varejo',
    estado: 'RJ',
    cnaes: ['4711301 — Comércio varejista de mercadorias em geral', '4712100 — Comércio varejista de produtos alimentícios'],
    municipios: 18,
    registros: 8400,
    ultimaExecucao: '2025-06-08T12:10:00',
    status: 'done',
    duracaoMedia: '8m 55s',
    criadoEm: '2025-02-20',
  },
  {
    id: 3,
    nome: 'MG — Indústria',
    estado: 'MG',
    cnaes: ['2821601 — Fabricação de maquinário industrial', '2941700 — Fabricação de peças automotivas'],
    municipios: 67,
    registros: 14200,
    ultimaExecucao: '2025-06-08T10:45:00',
    status: 'done',
    duracaoMedia: '12m 03s',
    criadoEm: '2025-01-10',
  },
  {
    id: 4,
    nome: 'PR — Agronegócio',
    estado: 'PR',
    cnaes: ['0111301 — Cultivo de trigo', '0112101 — Cultivo de milho e outros cereais'],
    municipios: 189,
    registros: 23600,
    ultimaExecucao: null,
    status: 'idle',
    duracaoMedia: '—',
    criadoEm: '2025-05-01',
  },
  {
    id: 5,
    nome: 'BA — Construção',
    estado: 'BA',
    cnaes: ['4120400 — Construção de edifícios'],
    municipios: 22,
    registros: 0,
    ultimaExecucao: '2025-06-07T18:20:00',
    status: 'error',
    duracaoMedia: '—',
    criadoEm: '2025-04-12',
  },
];

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtNum = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const STATUS_LABEL = { done: 'Concluído', idle: 'Aguardando', error: 'Erro', running: 'Em execução' };

/* mock log lines */
const buildLogs = (plano, incremental) => [
  { t: 0,    type: 'info',    msg: `Iniciando ${incremental ? 'atualização incremental' : 'execução completa'}: ${plano.nome}` },
  { t: 400,  type: 'info',    msg: `Carregando ${plano.cnaes.length} CNAE(s) configurado(s)` },
  { t: 900,  type: 'info',    msg: `Carregando ${plano.municipios} município(s) no escopo` },
  { t: 1500, type: 'success', msg: 'Conexão com fonte de dados estabelecida' },
  { t: 2200, type: 'info',    msg: incremental ? 'Modo incremental: buscando registros após última execução' : 'Modo completo: varrendo base inteira' },
  { t: 3100, type: 'info',    msg: `Processando lote 1/3 — filtrando por CNAE...` },
  { t: 4200, type: 'info',    msg: `Processando lote 2/3 — cruzando municípios...` },
  { t: 5300, type: 'info',    msg: `Processando lote 3/3 — deduplicando registros...` },
  { t: 6100, type: 'success', msg: `${fmtNum(plano.registros)} registros únicos encontrados` },
  { t: 6800, type: 'success', msg: 'Resultados gravados com sucesso' },
  { t: 7200, type: 'success', msg: `✓ Pipeline concluído em ${plano.duracaoMedia !== '—' ? plano.duracaoMedia : '~7s'}` },
];

/* ─── component ──────────────────────────────────────────── */
export default function Pipeline() {
  const [selectedId, setSelectedId]   = useState(PLANOS[0].id);
  const [running, setRunning]         = useState(false);
  const [progress, setProgress]       = useState(0);
  const [logs, setLogs]               = useState([]);
  const [runMode, setRunMode]         = useState(null); // 'full' | 'incremental'
  const logRef = useRef(null);

  const plano = PLANOS.find(p => p.id === selectedId);

  /* auto-scroll logs */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startRun = (incremental = false) => {
    setRunning(true);
    setProgress(0);
    setLogs([]);
    setRunMode(incremental ? 'incremental' : 'full');

    const lines = buildLogs(plano, incremental);
    const total = lines[lines.length - 1].t + 500;

    lines.forEach(({ t, type, msg }) => {
      setTimeout(() => {
        const ts = new Date().toLocaleTimeString('pt-BR');
        setLogs(prev => [...prev, { type, msg, ts }]);
        setProgress(Math.round(((t + 500) / total) * 100));
      }, t);
    });

    setTimeout(() => {
      setRunning(false);
      setProgress(100);
    }, total);
  };

  const clearLogs = () => { setLogs([]); setProgress(0); setRunMode(null); };

  return (
    <div className={styles.page}>
      {/* TOPBAR */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Pipeline</span>
          <span className={styles.topbarSub}>Execução e monitoramento</span>
        </div>
      </header>

      <div className={styles.content}>
        {/* ── LEFT COLUMN ── */}
        <div className={styles.left}>

          {/* SELECTOR */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Selecionar plano</span>
            </div>

            <label className={styles.label} htmlFor="plano-select">Plano ativo</label>
            <div className={styles.selectWrap}>
              <select
                id="plano-select"
                className={styles.select}
                value={selectedId}
                onChange={e => { setSelectedId(Number(e.target.value)); clearLogs(); }}
                disabled={running}
              >
                {PLANOS.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <i className="ti ti-chevron-down" aria-hidden="true" />
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.btnPrimary} ${running ? styles.btnDisabled : ''}`}
                onClick={() => startRun(false)}
                disabled={running}
              >
                {running && runMode === 'full'
                  ? <><span className={styles.spinner} /> Executando...</>
                  : <><i className="ti ti-player-play" aria-hidden="true" /> Executar pipeline</>
                }
              </button>
              <button
                className={`${styles.btnSecondary} ${running ? styles.btnDisabled : ''}`}
                onClick={() => startRun(true)}
                disabled={running}
                title="Processa apenas registros novos desde a última execução"
              >
                {running && runMode === 'incremental'
                  ? <><span className={styles.spinnerSm} /> Atualizando...</>
                  : <><i className="ti ti-refresh" aria-hidden="true" /> Atualização incremental</>
                }
              </button>
            </div>

            {(running || progress > 0) && (
              <div className={styles.progressWrap}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>
                    {running ? (runMode === 'incremental' ? 'Atualizando...' : 'Executando...') : 'Concluído'}
                  </span>
                  <span className={styles.progressPct}>{progress}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${!running && progress === 100 ? styles.progressDone : ''}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* PLAN INFO CARD */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Dados do plano</span>
              <span className={`${styles.statusBadge} ${styles['status_' + plano.status]}`}>
                {STATUS_LABEL[plano.status]}
              </span>
            </div>

            <div className={styles.planName}>{plano.nome}</div>
            <div className={styles.planState}>
              <i className="ti ti-map-pin" aria-hidden="true" />
              {plano.estado}
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>CNAEs</span>
                <span className={styles.infoVal}>{plano.cnaes.length}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Municípios</span>
                <span className={styles.infoVal}>{plano.municipios}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Registros</span>
                <span className={styles.infoVal}>{fmtNum(plano.registros)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Duração média</span>
                <span className={styles.infoVal}>{plano.duracaoMedia}</span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.metaRow}>
              <i className="ti ti-clock" aria-hidden="true" />
              <div>
                <span className={styles.metaLabel}>Última execução</span>
                <span className={styles.metaVal}>{fmtDate(plano.ultimaExecucao)}</span>
              </div>
            </div>
            <div className={styles.metaRow}>
              <i className="ti ti-calendar" aria-hidden="true" />
              <div>
                <span className={styles.metaLabel}>Criado em</span>
                <span className={styles.metaVal}>{new Date(plano.criadoEm).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.cnaeSection}>
              <span className={styles.cnaeTitle}>CNAEs configurados</span>
              {plano.cnaes.map((c, i) => (
                <div key={i} className={styles.cnaeItem}>
                  <span className={styles.cnaeDot} aria-hidden="true" />
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: LOGS ── */}
        <div className={styles.right}>
          <div className={`${styles.card} ${styles.logsCard}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Log de execução</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {logs.length > 0 && (
                  <button className={styles.clearBtn} onClick={clearLogs} disabled={running}>
                    <i className="ti ti-trash" aria-hidden="true" /> Limpar
                  </button>
                )}
                <span className={styles.logCount}>{logs.length} linha{logs.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className={styles.logArea} ref={logRef}>
              {logs.length === 0 ? (
                <div className={styles.logEmpty}>
                  <i className="ti ti-terminal-2" aria-hidden="true" />
                  <span>Selecione um plano e execute o pipeline para visualizar os logs.</span>
                </div>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className={`${styles.logLine} ${styles['log_' + line.type]}`}>
                    <span className={styles.logTs}>{line.ts}</span>
                    <span className={styles.logType}>{line.type === 'success' ? '✓' : line.type === 'error' ? '✗' : '›'}</span>
                    <span className={styles.logMsg}>{line.msg}</span>
                  </div>
                ))
              )}
              {running && (
                <div className={styles.logCursor}>
                  <span className={styles.cursorDot} />
                  <span className={styles.cursorDot} />
                  <span className={styles.cursorDot} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}