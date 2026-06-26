import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styles from './Pipeline.module.css';
import { planosApi } from '../api/planos';
import { cnaesApi } from '../api/cnaes';
import { pipelineApi } from '../api/pipeline';

/* ─── helpers ────────────────────────────────────────────── */
const fmtNum = (n) =>
  n == null ? '—' : (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const STATUS_LABEL = { done: 'Concluído', idle: 'Aguardando', error: 'Erro', running: 'Em execução' };

const POLL_INTERVAL_MS = 1500;

/* classifica a linha de log para colorir (apenas pelo conteúdo do texto,
   já que o backend manda texto puro, sem type estruturado) */
const classifyLog = (msg) => {
  if (msg.startsWith('✅') || msg.startsWith('✓') || msg.includes('FINALIZADO COM SUCESSO')) return 'success';
  if (msg.startsWith('❌') || msg.startsWith('⛔') || msg.toUpperCase().includes('ERRO')) return 'error';
  return 'info';
};

/* ─── component ──────────────────────────────────────────── */
export default function Pipeline() {
  const [planos, setPlanos]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [cnaesCatalogo, setCnaesCatalogo] = useState([]);

  const [selectedId, setSelectedId]   = useState(null);
  const [logs, setLogs]               = useState([]);
  const [rodando, setRodando]         = useState(false);
  const [actionError, setActionError] = useState('');
  const [starting, setStarting]       = useState(null); // 'full' | 'update' | null

  const logRef = useRef(null);
  const cursorRef = useRef(0);
  const pollTimerRef = useRef(null);

  /* ── carregar planos e catálogo de CNAEs do backend ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [planosData, cnaesData] = await Promise.all([
        planosApi.list(),
        cnaesApi.list().catch(() => []),
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

  /* ── polling de logs + status enquanto uma execução está rodando ── */
  const poll = useCallback(async (planoId) => {
    try {
      const resultado = await pipelineApi.logs(planoId, cursorRef.current);
      if (resultado.logs.length > 0) {
        setLogs(prev => [...prev, ...resultado.logs]);
      }
      cursorRef.current = resultado.total;
      setRodando(resultado.rodando);

      if (resultado.rodando) {
        pollTimerRef.current = setTimeout(() => poll(planoId), POLL_INTERVAL_MS);
      } else {
        // execução terminou (ou nunca rodou) — atualiza o plano para refletir status final
        const planoAtualizado = await planosApi.list();
        setPlanos(planoAtualizado);
      }
    } catch {
      // erro de rede no polling não deve travar a tela — tenta de novo no próximo ciclo
      pollTimerRef.current = setTimeout(() => poll(planoId), POLL_INTERVAL_MS);
    }
  }, []);

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  /* ── ao montar ou trocar de plano: se já houver uma execução em
     andamento para ele, recupera o histórico de log e retoma o polling.
     Se não estiver rodando, a tela simplesmente começa vazia. ── */
  useEffect(() => {
    if (!selectedId) return;

    let cancelado = false;

    (async () => {
      try {
        const { rodando: estaRodando } = await pipelineApi.status(selectedId);
        if (cancelado) return;

        if (estaRodando) {
          setRodando(true);
          cursorRef.current = 0;
          setLogs([]);
          poll(selectedId);
        }
      } catch {
        // se a checagem falhar, mantém o comportamento padrão (tela vazia)
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const trocarPlano = (id) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setSelectedId(id);
    setLogs([]);
    setRodando(false);
    setActionError('');
    cursorRef.current = 0;
  };

  const startRun = async (modo) => {
    if (!plano) return;
    setActionError('');
    setStarting(modo);
    setLogs([]);
    cursorRef.current = 0;

    try {
      if (modo === 'full') {
        await pipelineApi.executar(plano.id);
      } else {
        await pipelineApi.atualizar(plano.id);
      }
      setRodando(true);
      poll(plano.id);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setStarting(null);
    }
  };

  const handleParar = async () => {
    if (!plano) return;
    try {
      await pipelineApi.parar(plano.id);
    } catch (e) {
      setActionError(e.message);
    }
  };

  const clearLogs = () => { setLogs([]); cursorRef.current = 0; };

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
                    onChange={e => trocarPlano(Number(e.target.value))}
                    disabled={rodando}
                  >
                    {planos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <i className="ti ti-chevron-down" aria-hidden="true" />
                </div>

                {rodando ? (
                  <div className={styles.actions}>
                    <button className={styles.btnStop} onClick={handleParar}>
                      <i className="ti ti-player-stop" aria-hidden="true" /> Parar execução
                    </button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => startRun('full')}
                      disabled={starting !== null}
                    >
                      {starting === 'full'
                        ? <><span className={styles.spinner} /> Iniciando...</>
                        : <><i className="ti ti-player-play" aria-hidden="true" /> Executar pipeline</>
                      }
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => startRun('update')}
                      disabled={starting !== null}
                      title="Processa apenas o CAGED mais recente, sem reprocessar a RAIS"
                    >
                      {starting === 'update'
                        ? <><span className={styles.spinnerSm} /> Iniciando...</>
                        : <><i className="ti ti-refresh" aria-hidden="true" /> Atualização incremental</>
                      }
                    </button>
                  </div>
                )}

                {actionError && (
                  <div className={styles.actionError}>
                    <i className="ti ti-alert-circle" aria-hidden="true" /> {actionError}
                  </div>
                )}

                {(rodando || plano?.status === 'running') && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressHeader}>
                      <span className={styles.progressLabel}>
                        <span className={styles.liveDot} aria-hidden="true" />
                        {plano?.etapa_atual ? `Executando — ${plano.etapa_atual}` : 'Executando...'}
                      </span>
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
                  <span className={styles.infoVal}>{fmtNum(plano.municipios.length)}</span>
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
                  <button className={styles.clearBtn} onClick={clearLogs} disabled={rodando}>
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
                logs.map((line, i) => {
                  const type = classifyLog(line.msg);
                  return (
                    <div key={i} className={`${styles.logLine} ${styles['log_' + type]}`}>
                      <span className={styles.logTs}>{new Date(line.ts * 1000).toLocaleTimeString('pt-BR')}</span>
                      <span className={styles.logType}>{type === 'success' ? '✓' : type === 'error' ? '✗' : '›'}</span>
                      <span className={styles.logMsg}>{line.msg}</span>
                    </div>
                  );
                })
              )}
              {rodando && (
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