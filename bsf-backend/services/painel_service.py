"""
Camada de regras de negócio para o recurso Painéis.

Lê os arquivos CSV gerados pelo orquestrador (rais_caged.csv e
rais_caged_t.csv) e estrutura os dados em JSON pronto para os widgets do
frontend — o CSV bruto nunca é exposto, só os dados já processados por
"bloco de painel".

Pensado para crescer: cada gráfico/tabela do dashboard Power BI que for
replicado aqui ganha sua própria função `obter_<nome>()`. Hoje temos:
  - obter_serie_temporal(): total de vínculos por ano (gráfico de área)
  - obter_tabela_cnae(): vínculos por CNAE x ano (tabela)

Se os CSVs ainda não existem para o plano (pipeline não rodou), as
funções retornam None — a ausência de dado é tratada na rota como
"painel indisponível", não como erro.
"""
import os

import pandas as pd

from services.resultado_service import slugify

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

ANOS = ["2021", "2022", "2023", "2024", "2025", "2026"]


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


def obter_painel(nome_plano: str) -> dict:
    """
    Monta o payload completo do painel de um plano. Função de composição
    — ao adicionar um novo bloco de painel, basta incluir aqui.
    """
    if not dados_disponiveis(nome_plano):
        return {"disponivel": False}

    return {
        "disponivel": True,
        "serieTemporal": obter_serie_temporal(nome_plano),
        "tabelaCnae": obter_tabela_cnae(nome_plano),
    }