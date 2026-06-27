"""
Serviço que gerencia a execução do pipeline em background (thread separada),
para não bloquear o servidor Flask durante uma execução que pode levar
minutos.

Mantém, por plano, o estado da execução em andamento (logs acumulados,
flag de cancelamento) em memória — válido enquanto o processo Flask
estiver no ar. Isso é suficiente para o caso de uso atual (um operador
por vez); se múltiplas execuções simultâneas em produção se tornarem
necessárias, este é o ponto a evoluir para algo mais robusto (fila,
processo separado, etc.).
"""
import threading
import time
import traceback

from orquestrador.pipeline_runner import executar_full, executar_update
from services.cnae_service import list_cnaes
from services.plano_service import get_plano, update_status
from services.execucao_service import registrar_inicio, registrar_fim
from services.resultado_service import slugify

# Estado em memória por plano_id:
# {
#   "logs": [{"ts": float, "msg": str}, ...],
#   "stop_requested": bool,
#   "thread": Thread | None,
# }
_execucoes = {}
_lock = threading.Lock()


def _get_execucao(plano_id: int) -> dict:
    with _lock:
        if plano_id not in _execucoes:
            _execucoes[plano_id] = {"logs": [], "stop_requested": False, "thread": None}
        return _execucoes[plano_id]


MAX_LOGS_POR_PLANO = 2000
LINHAS_POR_CHAMADA = 500  # protege contra uma única mensagem com milhares de linhas


def _registrar_log(plano_id: int, msg: str):
    execucao = _get_execucao(plano_id)
    linhas = str(msg).split("\n")[:LINHAS_POR_CHAMADA]
    for linha in linhas:
        if linha.strip() == "":
            continue
        execucao["logs"].append({"ts": time.time(), "msg": linha})
        # corta durante o append, não só depois — evita que uma única
        # chamada com muitas linhas infle a lista muito além do limite
        if len(execucao["logs"]) > MAX_LOGS_POR_PLANO:
            del execucao["logs"][0]


def obter_logs(plano_id: int, desde: int = 0) -> dict:
    """
    Retorna os logs de uma execução a partir do índice `desde` (exclusivo),
    junto com o índice total atual — para o frontend usar como cursor na
    próxima chamada de polling.
    """
    execucao = _get_execucao(plano_id)
    logs = execucao["logs"]
    novos = logs[desde:]
    return {"logs": novos, "total": len(logs)}


def esta_rodando(plano_id: int) -> bool:
    execucao = _get_execucao(plano_id)
    thread = execucao["thread"]
    return thread is not None and thread.is_alive()


def solicitar_parada(plano_id: int) -> bool:
    """Sinaliza para a thread em execução que deve parar na próxima etapa."""
    if not esta_rodando(plano_id):
        return False
    execucao = _get_execucao(plano_id)
    execucao["stop_requested"] = True
    return True


def _run_in_thread(plano_id: int, modo: str):
    execucao = _get_execucao(plano_id)
    execucao["logs"] = []
    execucao["stop_requested"] = False

    def on_log(msg):
        _registrar_log(plano_id, msg)

    def on_etapa(nome_etapa):
        try:
            update_status(plano_id, "running", nome_etapa)
        except Exception:
            pass  # não deixa falha ao atualizar status interromper o pipeline

    def stop_flag():
        return execucao["stop_requested"]

    plano = get_plano(plano_id)
    if plano is None:
        _registrar_log(plano_id, f"❌ Plano {plano_id} não encontrado.")
        return

    catalogo_cnaes = list_cnaes()
    execucao_hist_id = registrar_inicio(plano_id, plano["nome"], modo)

    try:
        update_status(plano_id, "running", "Iniciando")

        if modo == "full":
            resultado = executar_full(plano, catalogo_cnaes, on_log=on_log, on_etapa=on_etapa, stop_flag=stop_flag)
        else:
            resultado = executar_update(plano, catalogo_cnaes, on_log=on_log, on_etapa=on_etapa, stop_flag=stop_flag)

        if resultado.get("interrompido"):
            update_status(plano_id, "idle")
            registrar_fim(execucao_hist_id, "idle")
        else:
            update_status(plano_id, "done")
            registrar_fim(execucao_hist_id, "done", plano["nome"], slugify)

    except Exception as e:
        _registrar_log(plano_id, f"❌ ERRO: {e}")
        _registrar_log(plano_id, traceback.format_exc())
        registrar_fim(execucao_hist_id, "error")
        try:
            update_status(plano_id, "error")
        except Exception:
            pass


def iniciar_execucao(plano_id: int, modo: str = "full") -> dict:
    """
    Inicia a execução do pipeline para um plano em uma thread separada.
    modo: "full" (execução completa) ou "update" (atualização incremental).

    Retorna imediatamente — o progresso deve ser acompanhado via
    obter_logs() e o status do Plano (GET /api/planos).
    """
    if modo not in ("full", "update"):
        raise ValueError("modo deve ser 'full' ou 'update'")

    if esta_rodando(plano_id):
        raise RuntimeError("Este plano já tem uma execução em andamento.")

    plano = get_plano(plano_id)
    if plano is None:
        raise ValueError("Plano não encontrado.")

    execucao = _get_execucao(plano_id)
    thread = threading.Thread(target=_run_in_thread, args=(plano_id, modo), daemon=True)
    execucao["thread"] = thread
    thread.start()

    return {"plano_id": plano_id, "modo": modo, "iniciado": True}