import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styles from './Pipeline.module.css';
import { planosApi } from '../api/planos';
import { cnaesApi } from '../api/cnaes';

/* ─── helpers ────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtNum = (n) =>
  n == null ? '—' : (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const STATUS_LABEL = { done: 'Concluído', idle: 'Aguardando', error: 'Erro', running: 'Em execução' };

/* mock log lines — simulação visual da execução, até o pipeline real existir */
const buildLogs = (plano, incremental) => [
  { t: 0,    type: 'info',    msg: `Iniciando ${incremental ? 'atualização incremental' : 'execução completa'}: ${plano.nome}` },
  { t: 400,  type: 'info',    msg: `Carregando ${plano.cnaes.length} CNAE(s) configurado(s)` },
  { t: 900,  type: 'info',    msg: `Carregando ${plano.municipios.length} município(s) no escopo` },
  { t: 1500, type: 'success', msg: 'Conexão com fonte de dados estabelecida' },
  { t: 2200, type: 'info',    msg: incremental ? 'Modo incremental: buscando registros após última execução' : 'Modo completo: varrendo base inteira' },
  { t: 3100, type: 'info',    msg: `Processando lote 1/3 — filtrando por CNAE...` },
  { t: 4200, type: 'info',    msg: `Processando lote 2/3 — cruzando municípios...` },
  { t: 5300, type: 'info',    msg: `Processando lote 3/3 — deduplicando registros...` },
  { t: 6100, type: 'success', msg: 'Registros únicos encontrados' },
  { t: 6800, type: 'success', msg: 'Resultados gravados com sucesso' },
  { t: 7200, type: 'success', msg: `✓ Pipeline concluído` },
];

/* ─── component ──────────────────────────────────────────── */
export default function Pipeline() {
  const [planos, setPlanos]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [cnaesCatalogo, setCnaesCatalogo] = useState([]);

  const [selectedId, setSelectedId]   = useState(null);
  const [running, setRunning]         = useState(false);
  const [progress, setProgress]       = useState(0);
  const [logs, setLogs]               = useState([]);
  const [runMode, setRunMode]         = useState(null); // 'full' | 'incremental'
  const logRef = useRef(null);

  /* ── carregar planos e catálogo de CNAEs do backend ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [planosData, cnaesData] = await Promise.all([
        planosApi.list(),
        cnaesApi.list().catch(() => []), // catálogo é só para enriquecer a exibição; não bloqueia a tela
      ]);
      setPlanos(planosData);
      setCnaesCatalogo(cnaesData);
      if (planosData.length > 0) {
        setSelectedId(prev => prev ?? planosData[0].id);
      }
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const plano = planos.find(p => p.id === selectedId);

  const cnaesDescritos = useMemo(() => {
    if (!plano) return [];
    return plano.cnaes.map(codigo => {
      const found = cnaesCatalogo.find(c => c.codigo === codigo);
      return found ? `${found.codigo} — ${found.descricao}` : codigo;
    });
  }, [plano, cnaesCatalogo]);

  /* auto-scroll logs */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startRun = (incremental = false) => {
    if (!plano) return;
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

            {loadError ? (
              <div className={styles.pipelineEmpty}>
                <i className="ti ti-plug-connected-x" aria-hidden="true" />
                <span>{loadError}</span>
                <button className={styles.btnSecondary} onClick={loadData} style={{ marginTop: 8 }}>
                  <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <div className={styles.pipelineEmpty}>
                <i className="ti ti-loader-2" aria-hidden="true" />
                <span>Carregando planos...</span>
              </div>
            ) : planos.length === 0 ? (
              <div className={styles.pipelineEmpty}>
                <i className="ti ti-file-off" aria-hidden="true" />
                <span>Nenhum plano cadastrado. Crie um em <strong>Planos</strong> no menu lateral.</span>
              </div>
            ) : (
              <>
                <label className={styles.label} htmlFor="plano-select">Plano ativo</label>
                <div className={styles.selectWrap}>
                  <select
                    id="plano-select"
                    className={styles.select}
                    value={selectedId ?? ''}
                    onChange={e => { setSelectedId(Number(e.target.value)); clearLogs(); }}
                    disabled={running}
                  >
                    {planos.map(p => (
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
              </>
            )}
          </div>

          {/* PLAN INFO CARD */}
          {plano && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Dados do plano</span>
                <span className={`${styles.statusBadge} ${styles['status_' + plano.status]}`}>
                  {STATUS_LABEL[plano.status] ?? 'Aguardando'}
                </span>
              </div>

              <div className={styles.planName}>{plano.nome}</div>
              <div className={styles.planState}>
                <i className="ti ti-map-pin" aria-hidden="true" />
                {plano.estado || '—'}{plano.regiao ? ` · ${plano.regiao}` : ''}
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CNAEs</span>
                  <span className={styles.infoVal}>{plano.cnaes.length}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Municípios</span>
                  <span className={styles.infoVal}>{plano.municipios.length}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Registros</span>
                  <span className={styles.infoVal}>{fmtNum(plano.registros)}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Duração média</span>
                  <span className={styles.infoVal}>{plano.duracaoMedia ?? '—'}</span>
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
                  <span className={styles.metaVal}>{plano.criadoEm ? new Date(plano.criadoEm).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.cnaeSection}>
                <span className={styles.cnaeTitle}>CNAEs configurados</span>
                {cnaesDescritos.length === 0 ? (
                  <div className={styles.cnaeItem}>
                    <span className={styles.cnaeDot} aria-hidden="true" />
                    Nenhum CNAE configurado neste plano
                  </div>
                ) : cnaesDescritos.map((c, i) => (
                  <div key={i} className={styles.cnaeItem}>
                    <span className={styles.cnaeDot} aria-hidden="true" />
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
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