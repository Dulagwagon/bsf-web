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

/* trunca textos longos de descrição de CNAE para caber no eixo do gráfico de barras */
const truncar = (texto, max = 42) =>
  texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;

/* ─── gráfico de linha (SVG puro, paleta dark/gold do BSF) ── */
function SerieTemporalChart({ dados }) {
  if (!dados || dados.length === 0) return null;

  const width = 600;
  const height = 260;
  const padding = { top: 36, right: 20, bottom: 32, left: 60 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const valores = dados.map(d => d.totalVinculos);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = (max - min) || 1;
  const yMin = min - span * 0.18;
  const yMax = max + span * 0.18;

  const x = (i) => padding.left + (i / (dados.length - 1)) * innerW;
  const y = (v) => padding.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const pontos = dados.map((d, i) => [x(i), y(d.totalVinculos)]);
  const linhaPath = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  const gridLines = 3;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) => yMin + ((yMax - yMin) / gridLines) * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg} role="img" aria-label="Gráfico de número de empregados ao longo dos anos">
      {/* grade */}
      {gridValues.map((v, i) => (
        <g key={i}>
          <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} className={styles.gridLine} />
          <text x={padding.left - 10} y={y(v)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
            {fmtCompact(Math.round(v))}
          </text>
        </g>
      ))}

      {/* linha (sem preenchimento de área) */}
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

/* ─── gráfico de barras horizontais (ranking CNAE no último ano fechado) ── */
function RankingBarChart({ dados, filtroAtivo, onClick }) {
  if (!dados || dados.length === 0) return null;

  const width = 600;
  const rowH = 28;
  const padding = { top: 8, right: 56, bottom: 28, left: 8 };
  const height = padding.top + padding.bottom + dados.length * rowH;
  const innerW = width - padding.left - padding.right;

  const max = Math.max(...dados.map(d => d.valor)) || 1;
  const barScale = (v) => (v / max) * innerW;

  const gridTicks = 4;
  const gridValues = Array.from({ length: gridTicks + 1 }, (_, i) => (max / gridTicks) * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg} role="img" aria-label="Gráfico de empregados por CNAE">
      {gridValues.map((v, i) => {
        const gx = padding.left + barScale(v);
        return (
          <g key={i}>
            <line x1={gx} x2={gx} y1={padding.top} y2={height - padding.bottom} className={styles.gridLine} />
            <text x={gx} y={height - padding.bottom + 16} className={styles.axisLabel} textAnchor="middle">
              {fmtCompact(Math.round(v))}
            </text>
          </g>
        );
      })}

      {dados.map((d, i) => {
        const yTop = padding.top + i * rowH;
        const barW = barScale(d.valor);
        const ativo = filtroAtivo === d.cnae;
        return (
          <g
            key={d.cnae}
            onClick={() => onClick && onClick(d.cnae)}
            className={onClick ? styles.barClickable : ''}
          >
            <rect x="0" y={yTop} width={width} height={rowH} fill="transparent" />
            <text x={padding.left} y={yTop + rowH / 2 - 6} className={`${styles.barLabel} ${ativo ? styles.barLabelActive : ''}`} textAnchor="start">
              {truncar(d.descricao)}
            </text>
            <rect
              x={padding.left} y={yTop + rowH / 2 - 2} width={Math.max(barW, 2)} height="9" rx="2"
              fill="var(--gold)" opacity={!filtroAtivo || ativo ? 0.85 : 0.3}
            />
            <text x={padding.left + barW + 8} y={yTop + rowH / 2 + 5} className={`${styles.barValueLabel} ${ativo ? styles.barLabelActive : ''}`} textAnchor="start">
              {fmtNum(d.valor)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── tabela CNAE × ano ──────────────────────────────────── */
function TabelaCnae({ linhas, filtroAtivo, onClick }) {
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
            <tr
              key={linha.cnae}
              onClick={() => onClick && onClick(linha.cnae)}
              className={`${onClick ? styles.rowClickable : ''} ${filtroAtivo === linha.cnae ? styles.rowClickableActive : ''}`}
            >
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

/* ─── widget genérico (header fixo + corpo) ─────────────── */
function WidgetCard({ icon, title, className = '', children, filtroAtivo, onLimpar }) {
  return (
    <div className={`${styles.card} ${styles.widgetCard} ${className} ${filtroAtivo ? styles.widgetCardFiltered : ''}`}>
      <div className={styles.widgetHeader}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        <span>{title}</span>
        {filtroAtivo && (
          <button className={styles.widgetClearBtn} onClick={onLimpar} title="Limpar este filtro">
            <i className="ti ti-filter-x" aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function WidgetVazio({ icon = 'ti-database-off', texto = 'Aguardando dados' }) {
  return (
    <div className={styles.widgetEmpty}>
      <i className={`ti ${icon}`} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

/* ─── sub-widgets de Dados do Setor (clicáveis) ──────────
   Recebem dados já agregados pelo backend ({chave, valor, descricao?}),
   não fazem agregação no cliente — o cross-filter recalcula no servidor
   a cada clique, sobre a base real (uma linha por CNPJ). */
function TabelaAnoInicio({ itens, total, filtroAtivo, onClick }) {
  return (
    <div className={styles.miniTableWrap}>
      <table className={styles.miniTable}>
        <thead>
          <tr><th>Ano</th><th className={styles.miniTableNum}>Empresas</th></tr>
        </thead>
        <tbody>
          {itens.map(({ chave: ano, valor: qtd }) => (
            <tr
              key={ano}
              className={`${styles.clickableRow} ${filtroAtivo === ano ? styles.clickableRowActive : ''}`}
              onClick={() => onClick(ano)}
            >
              <td>{ano}</td>
              <td className={styles.miniTableNum}>{fmtNum(qtd)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={styles.miniTableTotal}><td>Total</td><td className={styles.miniTableNum}>{fmtNum(total)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

function KpiDuplo({ itens, chaveA, chaveB, filtroAtivo, onClick }) {
  const valorA = itens.find(i => i.chave === chaveA)?.valor ?? 0;
  const valorB = itens.find(i => i.chave === chaveB)?.valor ?? 0;

  return (
    <div className={styles.kpiSimNao}>
      <button
        className={`${styles.kpiOption} ${filtroAtivo === chaveA ? styles.kpiOptionActive : ''}`}
        onClick={() => onClick(chaveA)}
      >
        <span className={styles.kpiLabel}>{chaveA}</span>
        <span className={styles.kpiValue}>{fmtNum(valorA)}</span>
      </button>
      <button
        className={`${styles.kpiOption} ${filtroAtivo === chaveB ? styles.kpiOptionActive : ''}`}
        onClick={() => onClick(chaveB)}
      >
        <span className={styles.kpiLabel}>{chaveB}</span>
        <span className={styles.kpiValue}>{fmtNum(valorB)}</span>
      </button>
    </div>
  );
}

function RankingMini({ itens, filtroAtivo, onClick }) {
  const max = Math.max(...itens.map(i => i.valor), 1);

  return (
    <div className={styles.rankingMini}>
      {itens.map(item => (
        <button
          key={item.chave}
          className={`${styles.rankingRow} ${filtroAtivo === item.chave ? styles.rankingRowActive : ''}`}
          onClick={() => onClick(item.chave)}
        >
          <span className={styles.rankingLabel}>{truncar(item.descricao ?? item.chave, 26)}</span>
          <span className={styles.rankingBarTrack}>
            <span className={styles.rankingBarFill} style={{ width: `${(item.valor / max) * 100}%` }} />
          </span>
          <span className={styles.rankingValue}>{fmtNum(item.valor)}</span>
        </button>
      ))}
    </div>
  );
}

function HistogramaAno({ itens, filtroAtivo, onClick }) {
  // limitado a partir de 2000 — com o intervalo completo (54 anos, indo
  // até 1966) as barras ficavam tão finas que o eixo perdia legibilidade
  const ordenado = [...itens]
    .filter(i => Number(i.chave) >= 2000)
    .sort((a, b) => a.chave.localeCompare(b.chave));
  const max = Math.max(...ordenado.map(i => i.valor), 1);

  // mostra o rótulo do ano só em marcações espaçadas (a cada 5 anos),
  // igual ao eixo do gráfico de referência — em todas ficaria ilegível
  const mostrarRotulo = (ano) => Number(ano) % 5 === 0;

  return (
    <div className={styles.histogramWrap}>
      <div className={styles.histogram}>
        {ordenado.map(({ chave: ano, valor: qtd }) => (
          <button
            key={ano}
            className={`${styles.histBar} ${filtroAtivo === ano ? styles.histBarActive : ''}`}
            style={{ height: `${(qtd / max) * 100}%` }}
            onClick={() => onClick(ano)}
            title={`${ano}: ${qtd} empresas`}
          />
        ))}
      </div>
      <div className={styles.histAxis}>
        {ordenado.map(({ chave: ano }) => (
          <span key={ano} className={styles.histAxisTick}>
            {mostrarRotulo(ano) ? ano : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── ABA: Dados do Setor (dados reais, lidos do backend) ── */
function AbaDadosSetor({ planoId }) {
  const [filtros, setFiltros] = useState({});
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const algumFiltroAtivo = Object.values(filtros).some(Boolean);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paineisApi.dadosSetor(planoId, filtros);
      setDados(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoId, JSON.stringify(filtros)]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggle = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: prev[campo] === valor ? undefined : valor }));
  };

  const limpar = (campo) => setFiltros(prev => ({ ...prev, [campo]: undefined }));
  const limparTudo = () => setFiltros({});

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-plug-connected-x" aria-hidden="true" />
          <span>{error}</span>
          <button className={styles.btnSecondary} onClick={carregar}>
            <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!loading && !dados?.disponivel) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-building-factory-2" aria-hidden="true" />
          <span>
            Ainda não há dados do setor para este plano.<br />
            Envie o arquivo na tela <strong>Resultados</strong> (botão "Enviar dados do setor").
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.setorWrap}>
      {algumFiltroAtivo && (
        <div className={styles.demoNotice}>
          <i className="ti ti-filter" aria-hidden="true" />
          Filtros ativos — {dados ? fmtNum(dados.total) : '...'} CNPJs correspondem aos critérios selecionados.
          <button className={styles.clearAllBtn} onClick={limparTudo}>
            <i className="ti ti-filter-x" aria-hidden="true" /> Limpar todos os filtros
          </button>
        </div>
      )}

      <div className={styles.setorGrid}>
        <WidgetCard
          icon="ti-calendar-stats" title="Ano de início das Empresas" className={styles.setorSpanRows2}
          filtroAtivo={filtros.anoInicio} onLimpar={() => limpar('anoInicio')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <TabelaAnoInicio itens={dados.porAnoInicio} total={dados.total} filtroAtivo={filtros.anoInicio} onClick={v => toggle('anoInicio', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-receipt-tax" title="Opção pelo Simples"
          filtroAtivo={filtros.simples} onLimpar={() => limpar('simples')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <KpiDuplo itens={dados.simples} chaveA="Sim" chaveB="Não" filtroAtivo={filtros.simples} onClick={v => toggle('simples', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-id-badge-2" title="Opção pelo MEI"
          filtroAtivo={filtros.mei} onLimpar={() => limpar('mei')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <KpiDuplo itens={dados.mei} chaveA="Sim" chaveB="Não" filtroAtivo={filtros.mei} onClick={v => toggle('mei', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-building-bank" title="Matriz / Filial"
          filtroAtivo={filtros.matriz} onLimpar={() => limpar('matriz')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <KpiDuplo itens={dados.matrizFilial} chaveA="Matriz" chaveB="Filial" filtroAtivo={filtros.matriz} onClick={v => toggle('matriz', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-map-pin" title="CNPJ por Município"
          filtroAtivo={filtros.municipio} onLimpar={() => limpar('municipio')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <RankingMini itens={dados.porMunicipio} filtroAtivo={filtros.municipio} onClick={v => toggle('municipio', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-cash" title="CNPJ por Capital Social"
          filtroAtivo={filtros.capitalSocial} onLimpar={() => limpar('capitalSocial')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <RankingMini itens={dados.porCapitalSocial} filtroAtivo={filtros.capitalSocial} onClick={v => toggle('capitalSocial', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-building" title="CNPJ por CNAE Fiscal"
          filtroAtivo={filtros.cnae} onLimpar={() => limpar('cnae')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <RankingMini itens={dados.porCnae} filtroAtivo={filtros.cnae} onClick={v => toggle('cnae', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-chart-histogram" title="Quantidade de CNPJ por Ano de início da Empresa" className={styles.setorSpan2}
          filtroAtivo={filtros.anoInicio} onLimpar={() => limpar('anoInicio')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <HistogramaAno itens={dados.porAnoInicio} filtroAtivo={filtros.anoInicio} onClick={v => toggle('anoInicio', v)} />
          )}
        </WidgetCard>

        <WidgetCard
          icon="ti-scale" title="CNPJ por Natureza Jurídica" className={styles.setorSpan2}
          filtroAtivo={filtros.naturezaJuridica} onLimpar={() => limpar('naturezaJuridica')}
        >
          {loading ? <WidgetVazio icon="ti-loader-2" texto="Carregando..." /> : (
            <RankingMini itens={dados.porNaturezaJuridica} filtroAtivo={filtros.naturezaJuridica} onClick={v => toggle('naturezaJuridica', v)} />
          )}
        </WidgetCard>
      </div>
    </div>
  );
}

/* ─── ABA: Empregados por CNAE (já existente, agora com cross-filter) ── */
function AbaEmpregadosCnae({ painel }) {
  const [cnaeFiltro, setCnaeFiltro] = useState(null);

  const toggleCnae = (cnae) => setCnaeFiltro(prev => (prev === cnae ? null : cnae));

  /* quando há filtro, deriva a série temporal e a tabela a partir dos
     valores por CNAE já carregados em tabelaCnae — sem precisar de
     nova chamada ao backend */
  const linhaSelecionada = useMemo(
    () => cnaeFiltro ? painel.tabelaCnae.find(l => l.cnae === cnaeFiltro) : null,
    [cnaeFiltro, painel.tabelaCnae]
  );

  const serieExibida = useMemo(() => {
    if (!linhaSelecionada) return painel.serieTemporal;
    return Object.entries(linhaSelecionada.valores).map(([ano, totalVinculos]) => ({ ano, totalVinculos }));
  }, [linhaSelecionada, painel.serieTemporal]);

  const tabelaExibida = useMemo(() => {
    if (!cnaeFiltro) return painel.tabelaCnae;
    return painel.tabelaCnae.filter(l => l.cnae === cnaeFiltro);
  }, [cnaeFiltro, painel.tabelaCnae]);

  const totalExibido = useMemo(() => {
    if (!serieExibida.length) return null;
    return serieExibida[serieExibida.length - 1].totalVinculos;
  }, [serieExibida]);

  return (
    <>
      {cnaeFiltro && (
        <div className={styles.demoNotice}>
          <i className="ti ti-filter" aria-hidden="true" />
          Filtrando por CNAE {cnaeFiltro} — {linhaSelecionada?.descricao}
          <button className={styles.clearAllBtn} onClick={() => setCnaeFiltro(null)}>
            <i className="ti ti-filter-x" aria-hidden="true" /> Limpar filtro
          </button>
        </div>
      )}

      <div className={styles.grid2}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <i className="ti ti-chart-line" aria-hidden="true" />
              Número de Empregados ao Longo dos Anos
            </span>
            {totalExibido != null && (
              <span className={styles.cardBadge}>{fmtNum(totalExibido)} no último ano</span>
            )}
          </div>
          <SerieTemporalChart dados={serieExibida} />
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <i className="ti ti-chart-bar" aria-hidden="true" />
              Número de Empregados por CNAE em {painel.anoUltimoFechado}
            </span>
          </div>
          <RankingBarChart dados={painel.rankingCnaeAno} filtroAtivo={cnaeFiltro} onClick={toggleCnae} />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>
            <i className="ti ti-table" aria-hidden="true" />
            Número de empregados por CNAE ao longo dos anos
          </span>
          <span className={styles.cardBadge}>{tabelaExibida.length} CNAE{tabelaExibida.length !== 1 ? 's' : ''}</span>
        </div>
        <TabelaCnae linhas={tabelaExibida} filtroAtivo={cnaeFiltro} onClick={toggleCnae} />
      </div>
    </>
  );
}

/* ─── ABA: Empregados por CNPJ (lista, sem agregação) ───── */
function AbaEmpregadosCnpj({ planoId }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paineisApi.listaCnpj(planoId);
      setDados(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [planoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const linhasFiltradas = useMemo(() => {
    if (!dados?.linhas) return [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return dados.linhas;
    return dados.linhas.filter(l =>
      l.cnpj.includes(termo) ||
      l.razaoSocial?.toLowerCase().includes(termo) ||
      l.municipio?.toLowerCase().includes(termo)
    );
  }, [dados, busca]);

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-loader-2" aria-hidden="true" />
          <span>Carregando lista de CNPJs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-plug-connected-x" aria-hidden="true" />
          <span>{error}</span>
          <button className={styles.btnSecondary} onClick={carregar}>
            <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!dados?.disponivel) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-building-factory-2" aria-hidden="true" />
          <span>
            Ainda não há dados do setor para este plano.<br />
            Envie o arquivo na tela <strong>Resultados</strong> (botão "Enviar dados do setor").
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <i className="ti ti-table" aria-hidden="true" />
          Estimativa do número de empregados por CNPJ
        </span>
        <span className={styles.cardBadge}>
          {fmtNum(linhasFiltradas.length)} de {fmtNum(dados.total)} CNPJ{dados.total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={styles.cnpjSearchWrap}>
        <i className="ti ti-search" aria-hidden="true" />
        <input
          className={styles.cnpjSearchInput}
          type="search"
          placeholder="Buscar por CNPJ, razão social ou município..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button className={styles.cnpjSearchClear} onClick={() => setBusca('')} aria-label="Limpar busca">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>

      {linhasFiltradas.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="ti ti-search-off" aria-hidden="true" />
          <span>Nenhum resultado para "{busca}"</span>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCnpj}>CNPJ</th>
                <th className={styles.thDesc}>Razão social</th>
                <th className={styles.thAno}>Empregados</th>
                <th className={styles.thAno}>Sócios</th>
                <th className={styles.thDesc}>Município</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map(linha => (
                <tr key={linha.cnpj}>
                  <td className={styles.tdCnae}>{linha.cnpj}</td>
                  <td className={styles.tdDesc}>{linha.razaoSocial || '—'}</td>
                  <td className={styles.tdAno}>{linha.empregados ?? '—'}</td>
                  <td className={styles.tdAno}>{linha.socios ?? '—'}</td>
                  <td className={styles.tdDesc}>{linha.municipio || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── gráfico de barras verticais (Empregados por Porte) ── */
function PorteBarChart({ itens }) {
  const width = 700;
  const height = 320;
  const padding = { top: 30, right: 20, bottom: 36, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...itens.map(i => i.valor), 1);
  const yMax = max * 1.12; // margem para o rótulo de valor não colar no topo

  const barGap = 24;
  const barW = (innerW - barGap * (itens.length - 1)) / itens.length;

  const gridTicks = 4;
  const gridValues = Array.from({ length: gridTicks + 1 }, (_, i) => (yMax / gridTicks) * i);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.chartSvg} role="img" aria-label="Gráfico de empresas por porte">
      {gridValues.map((v, i) => {
        const gy = padding.top + innerH - (v / yMax) * innerH;
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={gy} y2={gy} className={styles.gridLine} />
            <text x={padding.left - 10} y={gy} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
              {fmtCompact(Math.round(v))}
            </text>
          </g>
        );
      })}

      {itens.map((item, i) => {
        const x = padding.left + i * (barW + barGap);
        const h = (item.valor / yMax) * innerH;
        const y = padding.top + innerH - h;
        return (
          <g key={item.chave}>
            <text x={x + barW / 2} y={y - 10} className={styles.valueLabel} textAnchor="middle">
              {fmtNum(item.valor)}
            </text>
            <rect x={x} y={y} width={barW} height={h} fill="var(--gold)" opacity="0.85" rx="2" />
            <text x={x + barW / 2} y={height - padding.bottom + 18} className={styles.axisLabel} textAnchor="middle">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── ABA: Empregados por Porte ─────────────────────────── */
function AbaEmpregadosPorte({ planoId }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paineisApi.porte(planoId);
      setDados(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [planoId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-loader-2" aria-hidden="true" />
          <span>Carregando dados de porte...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-plug-connected-x" aria-hidden="true" />
          <span>{error}</span>
          <button className={styles.btnSecondary} onClick={carregar}>
            <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!dados?.disponivel) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="ti ti-building-factory-2" aria-hidden="true" />
          <span>
            Ainda não há dados do setor para este plano.<br />
            Envie o arquivo na tela <strong>Resultados</strong> (botão "Enviar dados do setor").
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <i className="ti ti-chart-bar" aria-hidden="true" />
          Estimativa do número de empregados pelo porte da empresa
        </span>
        <span className={styles.cardBadge}>{fmtNum(dados.total)} empresas</span>
      </div>
      <PorteBarChart itens={dados.porPorte} />
    </div>
  );
}

/* ─── ABA placeholder (para abas ainda não implementadas) ── */
function AbaPlaceholder({ titulo }) {
  return (
    <div className={styles.card}>
      <div className={styles.emptyState}>
        <i className="ti ti-tools" aria-hidden="true" />
        <span>
          <strong>{titulo}</strong> ainda está em construção.<br />
          Em breve esta aba trará os indicadores correspondentes.
        </span>
      </div>
    </div>
  );
}

/* ─── ABA: Notas Técnicas ────────────────────────────────── */
function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.notaLink}>
      {children}
      <i className="ti ti-external-link" aria-hidden="true" />
    </a>
  );
}

function AbaNotasTecnicas() {
  return (
    <div className={styles.card}>
      <div className={styles.notasWrap}>
        <section className={styles.notaSecao}>
          <h3 className={styles.notaTitulo}>Dados das empresas</h3>
          <ul className={styles.notaLista}>
            <li>
              O CNPJ, CNAE, porte e capital social das empresas foram obtidos a partir do site da{' '}
              <ExternalLink href="https://www.gov.br/receitafederal/pt-br">Receita Federal</ExternalLink>.
            </li>
          </ul>
        </section>

        <section className={styles.notaSecao}>
          <h3 className={styles.notaTitulo}>Informações sobre empregados das empresas</h3>
          <ul className={styles.notaLista}>
            <li>
              Quando não informado, o porte da empresa foi atribuído através dos valores do capital
              social em substituição ao faturamento (segundo o{' '}
              <ExternalLink href="https://www.bndes.gov.br/wps/portal/site/home/financiamento/guia/porte-de-empresa">
                BNDES
              </ExternalLink>
              , o porte da empresa pode ser atribuído a partir do seu faturamento).
            </li>
            <li>O número de empregados foi calculado a partir do porte da empresa.</li>
          </ul>
        </section>

        <section className={styles.notaSecao}>
          <h3 className={styles.notaTitulo}>Número de empregados por CNAE</h3>
          <ul className={styles.notaLista}>
            <li>
              Os dados referentes ao número de trabalhadores por CNAE foram coletados nos sites do{' '}
              <ExternalLink href="http://www.rais.gov.br/sitio/index.jsf">RAIS</ExternalLink> (até 2021)
              e do{' '}
              <ExternalLink href="http://pdet.mte.gov.br/novo-caged">Novo Caged</ExternalLink> (de
              janeiro de 2022 a abril de 2026).
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ─── navegação de abas ──────────────────────────────────── */
const TABS = [
  { id: 'setor', label: 'Dados do Setor' },
  { id: 'cnpj', label: 'Empregados por CNPJ' },
  { id: 'porte', label: 'Empregados por Porte' },
  { id: 'cnae', label: 'Empregados por CNAE' },
  { id: 'notas', label: 'Notas Técnicas' },
];

function TabNav({ active, onChange }) {
  return (
    <div className={styles.tabNav} role="tablist">
      {TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`${styles.tabBtn} ${active === tab.id ? styles.tabBtnActive : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ─── component principal ───────────────────────────────── */
export default function Paineis() {
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('setor');

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
            {/* CABEÇALHO DO PAINEL — nome do plano + descrição + datas de atualização */}
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderLeft}>
                <h1 className={styles.panelTitle}>{plano?.nome?.toUpperCase()}</h1>
                <p className={styles.panelSubtitle}>
                  {activeTab === 'setor'
                    ? 'Dados do Setor'
                    : activeTab === 'cnpj'
                    ? 'Estimativa do número de empregados por CNPJ'
                    : 'Estimativa do número de empregados por CNAE / RAIS · CAGED'}
                </p>
              </div>
              {painel?.disponivel && (
                <div className={styles.panelHeaderRight}>
                  <div className={styles.updateRow}>
                    <span className={styles.updateLabel}>Atualização dos Dados</span>
                    <span className={styles.updateValue}>{painel.atualizacaoDados ?? '—'}</span>
                  </div>
                  <div className={styles.updateRow}>
                    <span className={styles.updateLabel}>Atualização do Painel</span>
                    <span className={styles.updateValue}>{painel.atualizacaoPainel ?? '—'}</span>
                  </div>
                </div>
              )}
            </div>

            <TabNav active={activeTab} onChange={setActiveTab} />

            {activeTab === 'setor' && <AbaDadosSetor planoId={selectedId} />}

            {activeTab === 'cnpj' && <AbaEmpregadosCnpj planoId={selectedId} />}

            {activeTab === 'porte' && <AbaEmpregadosPorte planoId={selectedId} />}

            {activeTab === 'cnae' && (
              loadingPainel ? (
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
                <AbaEmpregadosCnae painel={painel} />
              )
            )}

            {activeTab === 'notas' && <AbaNotasTecnicas />}
          </>
        )}
      </div>
    </div>
  );
}