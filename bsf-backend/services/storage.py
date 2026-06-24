"""
Serviço genérico de persistência em arquivo JSON.
Usado por todos os recursos (CNAEs, Planos, Municípios) para ler/escrever
seus respectivos arquivos de dados de forma segura (escrita atômica).
"""
import json
import os
import tempfile
import threading

# Lock por arquivo, para evitar race conditions em escritas concorrentes
_locks = {}
_locks_guard = threading.Lock()


def _get_lock(path: str) -> threading.Lock:
    with _locks_guard:
        if path not in _locks:
            _locks[path] = threading.Lock()
        return _locks[path]


def read_json(path: str, default=None):
    """Lê um arquivo JSON. Retorna `default` se o arquivo não existir."""
    if not os.path.exists(path):
        return default if default is not None else []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str, data) -> None:
    """
    Escreve dados em JSON de forma atômica: grava em um arquivo temporário
    no mesmo diretório e depois substitui o arquivo original (os.replace).
    Isso evita que o arquivo fique corrompido caso o processo seja
    interrompido no meio da escrita.
    """
    lock = _get_lock(path)
    with lock:
        directory = os.path.dirname(path) or "."
        os.makedirs(directory, exist_ok=True)

        fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            os.replace(tmp_path, path)
        except Exception:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise
