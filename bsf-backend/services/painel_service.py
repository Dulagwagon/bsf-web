"""
Camada de regras de negócio para o recurso Painéis.

Lê os arquivos CSV gerados pelo orquestrador (rais_caged.csv e
rais_caged_t.csv) e estrutura os dados em JSON pronto para os widgets do
frontend — o CSV bruto nunca é exposto, só os dados já processados por
"bloco de painel".

Pensado para crescer: cada gráfico/tabela do dashboard Power BI que for
replicado aqui ganha sua própria função `obter_<nome>()`. Hoje temos:
  - obter_serie_temporal(): total de vínculos por ano (gráfico de linha)
  - obter_ranking_cnae_ano(): vínculos por CNAE no último ano fechado (barras)
  - obter_tabela_cnae(): vínculos por CNAE x ano (tabela)

Se os CSVs ainda não existem para o plano (pipeline não rodou), as
funções retornam None — a ausência de dado é tratada na rota como
"painel indisponível", não como erro.
"""
import os
from datetime import datetime

import pandas as pd

from services.resultado_service import slugify
from services.fonte_service import caged_mais_recente_disponivel

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

ANOS = ["2021", "2022", "2023", "2024", "2025", "2026"]

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]


def ultimo_ano_fechado() -> str:
    """
    O "último ano fechado" é sempre (ano atual do sistema - 1): o ano
    civil completo mais recente. O ano atual em si é considerado parcial
    (dados de CAGED incompletos), então não é usado neste cálculo.
    Ex: em 2026, retorna "2025". Em janeiro de 2027, retorna "2026".
    """
    return str(datetime.now().year - 1)


def _plano_dir(nome_plano: str) -> str:
    return os.path.join(OUTPUTS_DIR, slugify(nome_plano))


def _caminho_rais_caged(nome_plano: str) -> str:
    return os.path.join(_plano_dir(nome_plano), "rais_caged.csv")


def _caminho_rais_caged_t(nome_plano: str) -> str:
    return os.path.join(_plano_dir(nome_plano), "rais_caged_t.csv")


def dados_disponiveis(nome_plano: str) -> bool:
    """O painel depende de ambos os arquivos existirem."""
    return (
        os.path.isfile(_caminho_rais_caged(nome_plano))
        and os.path.isfile(_caminho_rais_caged_t(nome_plano))
    )


def obter_serie_temporal(nome_plano: str):
    """
    Lê rais_caged_t.csv e retorna o total de vínculos por ano:
    [{"ano": "2021", "totalVinculos": 614728}, ...]

    Corresponde ao gráfico "Número de Empregados ao Longo dos Anos".
    """
    caminho = _caminho_rais_caged_t(nome_plano)
    if not os.path.isfile(caminho):
        return None

    df = pd.read_csv(caminho, sep=";", dtype=str)

    if "ano" not in df.columns or "total_vinculos" not in df.columns:
        return None

    df["total_vinculos"] = pd.to_numeric(df["total_vinculos"], errors="coerce").fillna(0).astype(int)

    serie = [
        {"ano": str(row["ano"]), "totalVinculos": int(row["total_vinculos"])}
        for _, row in df.iterrows()
    ]
    # garante ordem cronológica, independente da ordem no arquivo
    serie.sort(key=lambda x: x["ano"])
    return serie


def obter_ranking_cnae_ano(nome_plano: str, ano: str = None):
    """
    Lê rais_caged.csv e retorna o ranking de vínculos por CNAE em um ano
    específico (por padrão, o último ano fechado), ordenado decrescente:
    [{"cnae": "8111700", "descricao": "...", "valor": 16553}, ...]

    Corresponde ao gráfico de barras "Número de Empregados por CNAE em <ano>".
    """
    ano = ano or ultimo_ano_fechado()

    caminho = _caminho_rais_caged(nome_plano)
    if not os.path.isfile(caminho):
        return None

    df = pd.read_csv(caminho, sep=";", dtype=str)

    if "cnae_fiscal" not in df.columns or "cnae" not in df.columns or ano not in df.columns:
        return None

    df[ano] = pd.to_numeric(df[ano], errors="coerce").fillna(0).astype(int)

    ranking = [
        {"cnae": str(row["cnae_fiscal"]), "descricao": str(row["cnae"]), "valor": int(row[ano])}
        for _, row in df.iterrows()
    ]
    ranking.sort(key=lambda r: r["valor"], reverse=True)
    return ranking


def obter_tabela_cnae(nome_plano: str):
    """
    Lê rais_caged.csv e retorna uma linha por CNAE, com a descrição e os
    valores de cada ano:
    [{"cnae": "4711302", "descricao": "...", "valores": {"2021": 71179, ...}}, ...]

    Ordenado pelo total de vínculos em ordem decrescente (igual ao Power BI,
    que ordena pela coluna mais recente/relevante).

    Corresponde à tabela "CNAE / Descrição / 2021..2026".
    """
    caminho = _caminho_rais_caged(nome_plano)
    if not os.path.isfile(caminho):
        return None

    df = pd.read_csv(caminho, sep=";", dtype=str)

    if "cnae_fiscal" not in df.columns or "cnae" not in df.columns:
        return None

    anos_presentes = [a for a in ANOS if a in df.columns]
    for ano in anos_presentes:
        df[ano] = pd.to_numeric(df[ano], errors="coerce").fillna(0).astype(int)

    linhas = []
    for _, row in df.iterrows():
        valores = {ano: int(row[ano]) for ano in anos_presentes}
        linhas.append({
            "cnae": str(row["cnae_fiscal"]),
            "descricao": str(row["cnae"]),
            "valores": valores,
        })

    # ordena pelo último ano disponível, decrescente — mesmo critério visual do Power BI
    if anos_presentes:
        ultimo_ano = anos_presentes[-1]
        linhas.sort(key=lambda l: l["valores"].get(ultimo_ano, 0), reverse=True)

    return linhas


def obter_atualizacao_dados() -> str:
    """
    "Atualização dos Dados": mês/ano do arquivo CAGED mais recente que
    existe em disco (.txt ou .parquet) — representa até onde a fonte de
    dados está alimentada, independente do plano em questão.
    Formato: "Abril | 2026". Retorna None se nenhum CAGED existir ainda.
    """
    info = caged_mais_recente_disponivel()
    if info is None:
        return None
    return f"{MESES_PT[info['mes'] - 1]} | {info['ano']}"


def obter_atualizacao_painel(nome_plano: str) -> str:
    """
    "Atualização do Painel": data de modificação do rais_caged.csv do
    plano — quando a última consolidação foi gerada pelo pipeline.
    Formato: "Maio | 2026". Retorna None se o arquivo não existir.
    """
    caminho = _caminho_rais_caged(nome_plano)
    if not os.path.isfile(caminho):
        return None
    mtime = datetime.fromtimestamp(os.path.getmtime(caminho))
    return f"{MESES_PT[mtime.month - 1]} | {mtime.year}"


def obter_painel(nome_plano: str) -> dict:
    """
    Monta o payload completo do painel de um plano. Função de composição
    — ao adicionar um novo bloco de painel, basta incluir aqui.
    """
    if not dados_disponiveis(nome_plano):
        return {"disponivel": False}

    ano_ranking = ultimo_ano_fechado()

    return {
        "disponivel": True,
        "anoUltimoFechado": ano_ranking,
        "atualizacaoDados": obter_atualizacao_dados(),
        "atualizacaoPainel": obter_atualizacao_painel(nome_plano),
        "serieTemporal": obter_serie_temporal(nome_plano),
        "rankingCnaeAno": obter_ranking_cnae_ano(nome_plano, ano_ranking),
        "tabelaCnae": obter_tabela_cnae(nome_plano),
    }