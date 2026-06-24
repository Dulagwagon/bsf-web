import styles from './Dashboard.module.css';
import ThemeToggle from '../components/ThemeToggle';

/* ── helpers ──────────────────────────────────────────────── */
const fmt = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const today = () =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

/* ── sub-components ───────────────────────────────────────── */
function MetricCard({ label, value, sub, delta, deltaUp, accent }) {
  return (
    <div className={`${styles.metric} ${styles[accent]}`}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {sub   && <div className={styles.metricSub}>{sub}</div>}
      {delta && (
        <span className={`${styles.delta} ${deltaUp ? styles.deltaUp : styles.deltaDown}`}>
          <i className={`ti ${deltaUp ? 'ti-arrow-up' : 'ti-arrow-down'}`} aria-hidden="true" />
          {delta}
        </span>
      )}
    </div>
  );
}

const STATUS_MAP = {
  running:  { dot: styles.dotRunning,  badge: styles.badgeRunning,  label: 'Em execução' },
  done:     { dot: styles.dotDone,     badge: styles.badgeDone,     label: 'Concluído'   },
  idle:     { dot: styles.dotIdle,     badge: styles.badgeIdle,     label: 'Aguardando'  },
  error:    { dot: styles.dotError,    badge: styles.badgeError,    label: 'Erro'        },
};

function PipelineItem({ name, meta, status, progress }) {
  const s = STATUS_MAP[status];
  return (
    <div className={styles.pipeItem}>
      <div className={`${styles.dot} ${s.dot}`} aria-hidden="true" />
      <div className={styles.pipeInfo}>
        <div className={styles.pipeName}>{name}</div>
        <div className={styles.pipeMeta}>{meta}</div>
        {status === 'running' && progress != null && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <span className={`${styles.badge} ${s.badge}`}>{status === 'running' ? `${progress}%` : s.label}</span>
    </div>
  );
}

function PlanItem({ icon, name, detail, count }) {
  return (
    <div className={styles.planItem}>
      <div className={styles.planIcon}><i className={`ti ${icon}`} aria-hidden="true" /></div>
      <div className={styles.planInfo}>
        <div className={styles.planName}>{name}</div>
        <div className={styles.planDetail}>{detail}</div>
      </div>
      <span className={styles.planCount}>{fmt(count)}</span>
    </div>
  );
}

function ActivityItem({ icon, text, time }) {
  return (
    <div className={styles.actItem}>
      <div className={styles.actIcon}><i className={`ti ${icon}`} aria-hidden="true" /></div>
      <div className={styles.actBody}>
        <div className={styles.actText} dangerouslySetInnerHTML={{ __html: text }} />
        <div className={styles.actTime}>{time}</div>
      </div>
    </div>
  );
}

const BAR_DATA = [
  { day: 'Seg', val: 5 },
  { day: 'Ter', val: 8 },
  { day: 'Qua', val: 4 },
  { day: 'Qui', val: 9 },
  { day: 'Sex', val: 6 },
  { day: 'Sáb', val: 7, active: true },
  { day: 'Dom', val: 5 },
];

const BAR_MAX = Math.max(...BAR_DATA.map(b => b.val));

function WeekChart() {
  return (
    <div className={styles.chartWrap}>
      <div className={styles.bars}>
        {BAR_DATA.map(b => (
          <div key={b.day} className={styles.barCol}>
            <div
              className={`${styles.bar} ${b.active ? styles.barActive : ''}`}
              style={{ height: `${Math.round((b.val / BAR_MAX) * 72)}px` }}
              title={`${b.val} execuções`}
            />
            <span className={styles.barLabel}>{b.day}</span>
          </div>
        ))}
      </div>
      <div className={styles.chartSummary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryNum}>38</span>
          <span className={styles.summaryLabel}>total</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={`${styles.summaryNum} ${styles.green}`}>36</span>
          <span className={styles.summaryLabel}>sucesso</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={`${styles.summaryNum} ${styles.red}`}>2</span>
          <span className={styles.summaryLabel}>erro</span>
        </div>
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

/* ── page ─────────────────────────────────────────────────── */
export default function Dashboard({ onRunPipeline, theme, onToggleTheme }) {
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
          <button className={`${styles.iconBtn} ${styles.hasBadge}`} aria-label="Notificações">
            <i className="ti ti-bell" aria-hidden="true" />
          </button>
          <button className={styles.iconBtn} aria-label="Ajuda">
            <i className="ti ti-help" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className={styles.content}>

        {/* METRICS */}
        <div className={styles.metrics}>
          <MetricCard label="Planos ativos"      value="12"    delta="+3 este mês"       deltaUp accent="gold"  />
          <MetricCard label="Registros filtrados" value="48.3k" delta="+12% vs. anterior" deltaUp accent="green" />
          <MetricCard label="Última execução"     value="2h"    sub="há 2 horas"                  accent="blue"  />
          <MetricCard label="Taxa de sucesso"     value="98.4%" delta="estável"           deltaUp accent="muted" />
        </div>

        {/* PIPELINE + PLANS */}
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Status do pipeline</span>
              <button className={styles.cardAction}>
                Ver todos <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.pipeList}>
              <PipelineItem name="Plano SP — Tecnologia" meta="CNAEs: 6201501, 6311900 · 42 municípios" status="running" progress={67} />
              <PipelineItem name="Plano RJ — Varejo"     meta="CNAEs: 4711301, 4712100 · 18 municípios" status="done" />
              <PipelineItem name="Plano MG — Indústria"  meta="CNAEs: 2821601, 2941700 · 67 municípios" status="done" />
              <PipelineItem name="Plano PR — Agronegócio" meta="CNAEs: 0111301, 0112101 · 189 municípios" status="idle" />
              <PipelineItem name="Plano BA — Construção" meta="CNAEs: 4120400 · 22 municípios"           status="error" />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Planos recentes</span>
              <button className={styles.cardAction}>
                Novo <i className="ti ti-plus" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.planList}>
              <PlanItem icon="ti-cpu"          name="SP — Tecnologia"  detail="2 CNAEs · 42 municípios"  count={2100} />
              <PlanItem icon="ti-shopping-cart" name="RJ — Varejo"      detail="2 CNAEs · 18 municípios"  count={8400} />
              <PlanItem icon="ti-tool"          name="MG — Indústria"   detail="2 CNAEs · 67 municípios"  count={14200} />
              <PlanItem icon="ti-plant"         name="PR — Agronegócio" detail="2 CNAEs · 189 municípios" count={23600} />
            </div>
          </div>
        </div>

        {/* BOTTOM */}
        <div className={styles.grid3}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Atividade recente</span>
            </div>
            <div className={styles.actList}>
              <ActivityItem icon="ti-player-play"   text="Pipeline <strong>SP — Tecnologia</strong> iniciado"                   time="agora mesmo" />
              <ActivityItem icon="ti-check"         text="<strong>MG — Indústria</strong> concluído com 14.2k registros"         time="1h atrás"    />
              <ActivityItem icon="ti-plus"          text="Plano <strong>RS — Logística</strong> criado"                          time="3h atrás"    />
              <ActivityItem icon="ti-alert-triangle" text="Erro em <strong>BA — Construção</strong>: fonte indisponível"          time="5h atrás"    />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Execuções — 7 dias</span>
            </div>
            <WeekChart />
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Cobertura dos planos</span>
            </div>
            <div className={styles.coverageList}>
              <CoverageItem label="CNAEs mapeados"    value="24"    pct={18} />
              <CoverageItem label="Municípios cobertos" value="338"  pct={6}  />
              <CoverageItem label="Estados ativos"    value="5"     pct={19} />
              <CoverageItem label="Registros únicos"  value="48.3k" pct={72} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}