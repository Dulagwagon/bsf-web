import { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './Paineis.module.css';
import { planosApi } from '../api/planos';
import { paineisApi } from '../api/paineis';

/* ─── helpers ────────────────────────────────────────────── */
const fmtNum = (n) => n.toLocaleString('pt-BR');

const fmtCompact = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} Mil`;
  return String(n);
};

/* ─── gráfico de área (SVG puro, paleta dark/gold do BSF) ── */
function SerieTemporalChart({ dados }) {
  if (!dados || dados.length === 0) return null;

  const width = 900;
  const height = 280;
  const padding = { top: 36, right: 24, bottom: 32, left: 64 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const valores = dados.map(d => d.totalVinculos);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = (max - min) || 1;
  // dá uma margem de 10% acima/abaixo para os rótulos não colarem nas bordas
  const yMin = min - span * 0.15;
  const yMax = max + span * 0.15;

  const x = (i) => padding.left + (i / (dados.length - 1)) * innerW;
  const y = (v) => padding.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const pontos = dados.map((d, i) => [x(i), y(d.totalVinculos)]);
  const linhaPath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaPath = `${linhaPath} L ${pontos[pontos.length - 1][0]} ${padding.top + innerH} L ${pontos[0][0]} ${padding.top + innerH} Z`;

  // grade horizontal de referência (4 linhas)
  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => yMin + ((yMax - yMin) / gridLines) * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg} role="img" aria-label="Gráfico de número de empregados ao longo dos anos">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grade */}
      {gridValues.map((v, i) => (
        <g key={i}>
          <line
            x1={padding.left} x2={width - padding.right}
            y1={y(v)} y2={y(v)}
            className={styles.gridLine}
          />
          <text x={padding.left - 10} y={y(v)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
            {fmtCompact(Math.round(v))}
          </text>
        </g>
      ))}

      {/* área preenchida */}
      <path d={areaPath} fill="url(#areaFill)" />

      {/* linha */}
      <path d={linhaPath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* pontos + rótulos de valor + eixo X */}
      {dados.map((d, i) => (
        <g key={d.ano}>
          <circle cx={x(i)} cy={y(d.totalVinculos)} r="4" fill="var(--bg-surface)" stroke="var(--gold)" strokeWidth="2.5" />
          <text x={x(i)} y={y(d.totalVinculos) - 14} className={styles.valueLabel} textAnchor="middle">
            {fmtNum(d.totalVinculos)}
          </text>
          <text x={x(i)} y={height - 8} className={styles.axisLabel} textAnchor="middle">
            {d.ano}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── tabela CNAE × ano ──────────────────────────────────── */
function TabelaCnae({ linhas }) {
  if (!linhas || linhas.length === 0) return null;

  const anos = Object.keys(linhas[0].valores);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thCnae}>CNAE</th>
            <th className={styles.thDesc}>Descrição</th>
            {anos.map(ano => <th key={ano} className={styles.thAno}>{ano}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map(linha => (
            <tr key={linha.cnae}>
              <td className={styles.tdCnae}>{linha.cnae}</td>
              <td className={styles.tdDesc}>{linha.descricao}</td>
              {anos.map(ano => (
                <td key={ano} className={styles.tdAno}>{fmtNum(linha.valores[ano])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── component principal ───────────────────────────────── */
export default function Paineis() {
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [painel, setPainel] = useState(null);
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [painelError, setPainelError] = useState('');

  const loadPlanos = useCallback(async () => {
    setLoadingPlanos(true);
    setLoadError('');
    try {
      const data = await planosApi.list();
      setPlanos(data);
      if (data.length > 0) setSelectedId(prev => prev ?? data[0].id);
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoadingPlanos(false);
    }
  }, []);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);

  const plano = planos.find(p => p.id === selectedId);

  const loadPainel = useCallback(async (planoId) => {
    setLoadingPainel(true);
    setPainelError('');
    try {
      const data = await paineisApi.get(planoId);
      setPainel(data);
    } catch (e) {
      setPainelError(e.message);
    } finally {
      setLoadingPainel(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadPainel(selectedId);
  }, [selectedId, loadPainel]);

  const totalAtual = useMemo(() => {
    if (!painel?.serieTemporal?.length) return null;
    return painel.serieTemporal[painel.serieTemporal.length - 1].totalVinculos;
  }, [painel]);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.topbarTitle}>Painéis</span>
          <span className={styles.topbarSub}>Indicadores por plano, a partir dos dados do pipeline</span>
        </div>

        {!loadingPlanos && planos.length > 0 && (
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={selectedId ?? ''}
              onChange={e => setSelectedId(Number(e.target.value))}
            >
              {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <i className="ti ti-chevron-down" aria-hidden="true" />
          </div>
        )}
      </header>

      <div className={styles.content}>
        {loadError ? (
          <div className={styles.emptyState}>
            <i className="ti ti-plug-connected-x" aria-hidden="true" />
            <span>{loadError}</span>
            <button className={styles.btnSecondary} onClick={loadPlanos}>
              <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
            </button>
          </div>
        ) : loadingPlanos ? (
          <div className={styles.emptyState}>
            <i className="ti ti-loader-2" aria-hidden="true" />
            <span>Carregando planos...</span>
          </div>
        ) : planos.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="ti ti-file-off" aria-hidden="true" />
            <span>Nenhum plano cadastrado. Crie um em <strong>Planos</strong> no menu lateral.</span>
          </div>
        ) : (
          <>
            {/* CABEÇALHO DO PAINEL — nome do plano + descrição */}
            <div className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>{plano?.nome?.toUpperCase()}</h1>
              <p className={styles.panelSubtitle}>Estimativa do número de empregados por CNAE / RAIS · CAGED</p>
            </div>

            {loadingPainel ? (
              <div className={styles.card}>
                <div className={styles.emptyState}>
                  <i className="ti ti-loader-2" aria-hidden="true" />
                  <span>Carregando dados do painel...</span>
                </div>
              </div>
            ) : painelError ? (
              <div className={styles.card}>
                <div className={styles.emptyState}>
                  <i className="ti ti-plug-connected-x" aria-hidden="true" />
                  <span>{painelError}</span>
                  <button className={styles.btnSecondary} onClick={() => loadPainel(selectedId)}>
                    <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                  </button>
                </div>
              </div>
            ) : !painel?.disponivel ? (
              <div className={styles.card}>
                <div className={styles.emptyState}>
                  <i className="ti ti-chart-area-line" aria-hidden="true" />
                  <span>
                    Ainda não há dados disponíveis para <strong>{plano?.nome}</strong>.<br />
                    Execute o pipeline na tela <strong>Pipeline</strong> para gerar os resultados.
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <i className="ti ti-chart-area-line" aria-hidden="true" />
                      Número de Empregados ao Longo dos Anos
                    </span>
                    {totalAtual != null && (
                      <span className={styles.cardBadge}>{fmtNum(totalAtual)} no último ano</span>
                    )}
                  </div>
                  <SerieTemporalChart dados={painel.serieTemporal} />
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <i className="ti ti-table" aria-hidden="true" />
                      Vínculos por CNAE
                    </span>
                    <span className={styles.cardBadge}>{painel.tabelaCnae.length} CNAE{painel.tabelaCnae.length !== 1 ? 's' : ''}</span>
                  </div>
                  <TabelaCnae linhas={painel.tabelaCnae} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}