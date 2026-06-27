import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './Dashboard.module.css';
import ThemeToggle from '../components/ThemeToggle';
import { planosApi } from '../api/planos';
import { cnaesApi } from '../api/cnaes';
import { municipiosApi } from '../api/municipios';
import { pipelineApi } from '../api/pipeline';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n) =>
  n == null ? '—' : (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const today = () =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const fmtRelativo = (epochSeconds) => {
  if (!epochSeconds) return '—';
  const diffMs = Date.now() - epochSeconds * 1000;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
};

const fmtDuracao = (segundos) => {
  if (segundos == null) return '—';
  if (segundos < 60) return `${Math.round(segundos)}s`;
  const min = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${min}m ${s}s`;
};

/* ── sub-components ───────────────────────────────────────── */
function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={`${styles.metric} ${styles[accent]}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}

const STATUS_MAP = {
  running:  { dot: styles.dotRunning,  badge: styles.badgeRunning,  label: 'Em execução' },
  done:     { dot: styles.dotDone,     badge: styles.badgeDone,     label: 'Concluído'   },
  idle:     { dot: styles.dotIdle,     badge: styles.badgeIdle,     label: 'Aguardando'  },
  error:    { dot: styles.dotError,    badge: styles.badgeError,    label: 'Erro'        },
};

function PipelineItem({ name, meta, status }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.idle;
  return (
    <div className={styles.pipeItem}>
      <div className={`${styles.dot} ${s.dot}`} aria-hidden="true" />
      <div className={styles.pipeInfo}>
        <div className={styles.pipeName}>{name}</div>
        <div className={styles.pipeMeta}>{meta}</div>
      </div>
      <span className={`${styles.badge} ${s.badge}`}>{s.label}</span>
    </div>
  );
}

function PlanItem({ icon, name, detail }) {
  return (
    <div className={styles.planItem}>
      <div className={styles.planIcon}><i className={`ti ${icon}`} aria-hidden="true" /></div>
      <div className={styles.planInfo}>
        <div className={styles.planName}>{name}</div>
        <div className={styles.planDetail}>{detail}</div>
      </div>
    </div>
  );
}

function CoverageItem({ label, value, pct }) {
  return (
    <div className={styles.coverageItem}>
      <div className={styles.coverageRow}>
        <span className={styles.coverageLabel}>{label}</span>
        <span className={styles.coverageVal}>{value}</span>
      </div>
      <div className={styles.coverageBar}>
        <div className={styles.coverageFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyBlock({ icon, children }) {
  return (
    <div className={styles.emptyBlock}>
      <i className={`ti ${icon}`} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

const EXEC_STATUS_MAP = {
  done:    { icon: 'ti-check',          cls: styles.execDone,    label: 'Concluída' },
  error:   { icon: 'ti-alert-triangle', cls: styles.execError,   label: 'Erro' },
  idle:    { icon: 'ti-player-stop',    cls: styles.execStopped, label: 'Interrompida' },
  running: { icon: 'ti-loader-2',       cls: styles.execRunning, label: 'Em execução' },
};

function ExecucaoItem({ execucao }) {
  const s = EXEC_STATUS_MAP[execucao.status] ?? EXEC_STATUS_MAP.idle;
  return (
    <div className={styles.execItem}>
      <div className={`${styles.execIcon} ${s.cls}`}>
        <i className={`ti ${s.icon}`} aria-hidden="true" />
      </div>
      <div className={styles.execInfo}>
        <div className={styles.execName}>
          {execucao.planoNome}
          <span className={styles.execMode}>{execucao.modo === 'update' ? 'incremental' : 'completa'}</span>
        </div>
        <div className={styles.execMeta}>
          {s.label}
          {execucao.status === 'done' && execucao.registros != null && ` · ${fmt(execucao.registros)} registros`}
          {execucao.duracaoSegundos != null && ` · ${fmtDuracao(execucao.duracaoSegundos)}`}
        </div>
      </div>
      <span className={styles.execTime}>{fmtRelativo(execucao.iniciadoEm)}</span>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function Dashboard({ onRunPipeline, theme, onToggleTheme }) {
  const [planos, setPlanos]         = useState([]);
  const [cnaesTotal, setCnaesTotal] = useState(null);
  const [municipiosTotal, setMunicipiosTotal] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [statusSearch, setStatusSearch] = useState('');
  const [execucoes, setExecucoes]   = useState([]);
  const [loadingExec, setLoadingExec] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [planosData, cnaesData, municipiosData] = await Promise.all([
        planosApi.list(),
        cnaesApi.list().catch(() => []),
        municipiosApi.list().catch(() => []),
      ]);
      setPlanos(planosData);
      setCnaesTotal(cnaesData.length);
      setMunicipiosTotal(municipiosData.length);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadExecucoes = useCallback(async () => {
    setLoadingExec(true);
    try {
      const data = await pipelineApi.historico({ limite: 50 });
      setExecucoes(data);
    } catch {
      setExecucoes([]);
    } finally {
      setLoadingExec(false);
    }
  }, []);

  useEffect(() => { loadExecucoes(); }, [loadExecucoes]);

  /* ── métricas derivadas dos planos reais ── */
  const stats = useMemo(() => {
    const cnaesUnicos = new Set();
    const municipiosUnicos = new Set();
    const estadosAtivos = new Set();
    let emErro = 0;

    planos.forEach(p => {
      p.cnaes.forEach(c => cnaesUnicos.add(c));
      p.municipios.forEach(m => municipiosUnicos.add(m));
      if (p.estado) estadosAtivos.add(p.estado);
      if (p.status === 'error') emErro++;
    });

    return {
      totalPlanos: planos.length,
      cnaesUnicos: cnaesUnicos.size,
      municipiosUnicos: municipiosUnicos.size,
      estadosAtivos: estadosAtivos.size,
      emErro,
    };
  }, [planos]);

  const planosRecentes = useMemo(() =>
    [...planos].slice(-4).reverse(),
    [planos]
  );

  const planosFiltrados = useMemo(() => {
    if (!statusSearch.trim()) return planos;
    const q = statusSearch.trim().toLowerCase();
    return planos.filter(p => p.nome.toLowerCase().includes(q));
  }, [planos, statusSearch]);

  /* soma os registros da execução mais recente de cada plano (apenas concluídas) */
  const totalRegistros = useMemo(() => {
    const maisRecentePorPlano = new Map();
    execucoes
      .filter(e => e.status === 'done' && e.registros != null)
      .forEach(e => {
        if (!maisRecentePorPlano.has(e.planoId)) maisRecentePorPlano.set(e.planoId, e.registros);
      });
    if (maisRecentePorPlano.size === 0) return null;
    return [...maisRecentePorPlano.values()].reduce((a, b) => a + b, 0);
  }, [execucoes]);

  const coveragePct = (value, total) => {
    if (!total) return 0;
    return Math.min(100, Math.round((value / total) * 100));
  };

  return (
    <div className={styles.page}>
      {/* TOPBAR */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Dashboard</span>
          <span className={styles.topbarDate}>{today()}</span>
        </div>
        <div className={styles.topbarRight}>
          <button className={styles.runBtn} onClick={onRunPipeline}>
            <i className="ti ti-player-play" aria-hidden="true" />
            Executar pipeline
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className={styles.iconBtn} aria-label="Notificações">
            <i className="ti ti-bell" aria-hidden="true" />
          </button>
          <button className={styles.iconBtn} aria-label="Ajuda">
            <i className="ti ti-help" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className={styles.content}>

        {loadError && (
          <div className={styles.errorBanner}>
            <i className="ti ti-plug-connected-x" aria-hidden="true" />
            {loadError}
            <button onClick={loadData}><i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente</button>
          </div>
        )}

        {/* METRICS */}
        <div className={styles.metrics}>
          <MetricCard
            label="Planos cadastrados"
            value={loading ? '—' : stats.totalPlanos}
            sub={!loading && stats.emErro > 0 ? `${stats.emErro} com erro` : undefined}
            accent="gold"
          />
          <MetricCard
            label="CNAEs no catálogo"
            value={loading ? '—' : fmt(cnaesTotal)}
            accent="green"
          />
          <MetricCard
            label="Municípios no catálogo"
            value={loading ? '—' : fmt(municipiosTotal)}
            accent="blue"
          />
          <MetricCard
            label="Registros filtrados"
            value={loadingExec ? '—' : (totalRegistros != null ? fmt(totalRegistros) : '—')}
            sub={totalRegistros == null ? 'disponível após executar o pipeline' : 'soma da última execução de cada plano'}
            accent="muted"
          />
        </div>

        {/* PIPELINE + PLANS */}
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Status dos planos</span>
            </div>

            {!loading && planos.length > 0 && (
              <div className={styles.statusSearchWrap}>
                <i className="ti ti-search" aria-hidden="true" />
                <input
                  className={styles.statusSearchInput}
                  type="search"
                  placeholder="Buscar plano..."
                  value={statusSearch}
                  onChange={e => setStatusSearch(e.target.value)}
                />
                {statusSearch && (
                  <button
                    className={styles.statusSearchClear}
                    onClick={() => setStatusSearch('')}
                    aria-label="Limpar busca"
                  >
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <EmptyBlock icon="ti-loader-2">Carregando...</EmptyBlock>
            ) : planos.length === 0 ? (
              <EmptyBlock icon="ti-file-off">Nenhum plano cadastrado ainda. Crie um na tela Planos.</EmptyBlock>
            ) : planosFiltrados.length === 0 ? (
              <EmptyBlock icon="ti-search-off">Nenhum plano encontrado para "{statusSearch}"</EmptyBlock>
            ) : (
              <div className={styles.pipeList}>
                {planosFiltrados.map(p => (
                  <PipelineItem
                    key={p.id}
                    name={p.nome}
                    meta={`${p.cnaes.length} CNAE${p.cnaes.length !== 1 ? 's' : ''} · ${p.municipios.length} município${p.municipios.length !== 1 ? 's' : ''}`}
                    status={p.status}
                  />
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Planos recentes</span>
            </div>
            {loading ? (
              <EmptyBlock icon="ti-loader-2">Carregando...</EmptyBlock>
            ) : planosRecentes.length === 0 ? (
              <EmptyBlock icon="ti-file-off">Nenhum plano cadastrado ainda.</EmptyBlock>
            ) : (
              <div className={styles.planList}>
                {planosRecentes.map(p => (
                  <PlanItem
                    key={p.id}
                    icon="ti-file-description"
                    name={p.nome}
                    detail={`${p.estado || '—'} · ${p.cnaes.length} CNAE${p.cnaes.length !== 1 ? 's' : ''} · ${p.municipios.length} município${p.municipios.length !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM */}
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Execuções recentes</span>
            </div>
            {loadingExec ? (
              <EmptyBlock icon="ti-loader-2">Carregando...</EmptyBlock>
            ) : execucoes.length === 0 ? (
              <EmptyBlock icon="ti-history">Nenhuma execução registrada ainda. Execute um plano na tela Pipeline.</EmptyBlock>
            ) : (
              <div className={styles.execList}>
                {execucoes.slice(0, 8).map(e => (
                  <ExecucaoItem key={e.id} execucao={e} />
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Cobertura dos planos</span>
            </div>
            {loading ? (
              <EmptyBlock icon="ti-loader-2">Carregando...</EmptyBlock>
            ) : (
              <div className={styles.coverageList}>
                <CoverageItem
                  label="CNAEs em uso"
                  value={`${stats.cnaesUnicos} / ${cnaesTotal ?? 0}`}
                  pct={coveragePct(stats.cnaesUnicos, cnaesTotal)}
                />
                <CoverageItem
                  label="Municípios em uso"
                  value={`${stats.municipiosUnicos} / ${municipiosTotal ?? 0}`}
                  pct={coveragePct(stats.municipiosUnicos, municipiosTotal)}
                />
                <CoverageItem
                  label="Estados ativos"
                  value={stats.estadosAtivos}
                  pct={coveragePct(stats.estadosAtivos, 27)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}