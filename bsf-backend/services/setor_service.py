"""
Camada de regras de negócio para os widgets de "Dados do Setor" (aba da
tela Painéis).

Lê o arquivo dados_setor.csv — uma linha por CNPJ, com atributos como
município, ano de início, opção pelo Simples/MEI, capital social, CNAE
fiscal e natureza jurídica — e devolve os dados já agregados por widget,
aplicando os filtros de cross-filter recebidos (cada clique na tela
reenvia os filtros ativos e o backend recalcula em cima da base completa).

O arquivo é pequeno o suficiente (uma linha por CNPJ de um plano) para
ser lido e filtrado a cada requisição sem necessidade de cache — se isso
deixar de ser verdade (planos muito grandes), o ponto de evolução é
cachear o DataFrame por plano em memória.
"""
import os

import pandas as pd

from services.resultado_service import slugify

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

NOME_ARQUIVO = "dados_setor.csv"

# Filtros aceitos: chave usada na querystring -> coluna correspondente no CSV.
FILTROS_SUPORTADOS = {
    "anoInicio": "ano_inicio",          # derivado de data_inicio_ativ
    "municipio": "municipio",
    "simples": "simples",               # "Sim" / "Não"
    "mei": "mei",                       # "Sim" / "Não"
    "matriz": "matriz_filial",          # "Matriz" / "Filial"
    "capitalSocial": "faixa_capital_social",
    "cnae": "cnae_fiscal",
    "naturezaJuridica": "natureza_juridica",
}


def _caminho_csv(nome_plano: str) -> str:
    return os.path.join(OUTPUTS_DIR, slugify(nome_plano), NOME_ARQUIVO)


def dados_disponiveis(nome_plano: str) -> bool:
    return os.path.isfile(_caminho_csv(nome_plano))


def _carregar(nome_plano: str) -> pd.DataFrame:
    """
    Lê o CSV e prepara as colunas derivadas usadas pelos widgets.
    Mantém os valores originais das colunas (mesmos rótulos que já
    existem no arquivo da Receita/RAIS) — não inventa nem traduz nada.
    """
    df = pd.read_csv(_caminho_csv(nome_plano), dtype=str)
    df["ano_inicio"] = df["data_inicio_ativ"].str[:4]
    return df


def _aplicar_filtros(df: pd.DataFrame, filtros: dict) -> pd.DataFrame:
    """
    Aplica, em AND, todos os filtros ativos recebidos. filtros é um dict
    {chave_frontend: valor}; chaves vazias/ausentes são ignoradas.
    """
    for chave, valor in filtros.items():
        if not valor:
            continue
        coluna = FILTROS_SUPORTADOS.get(chave)
        if coluna is None or coluna not in df.columns:
            continue
        df = df[df[coluna] == valor]
    return df


def _contagem(df: pd.DataFrame, coluna: str) -> list:
    """Lista [{chave, valor}] com a contagem de CNPJs por valor da coluna, decrescente."""
    contagem = df[coluna].value_counts()
    return [{"chave": k, "valor": int(v)} for k, v in contagem.items()]


def obter_dados_setor(nome_plano: str, filtros: dict) -> dict:
    """
    Monta o payload completo dos 9 widgets de "Dados do Setor", já
    filtrado pelos critérios ativos. Cada widget reflete a MESMA base
    filtrada — é isso que viabiliza o cross-filter (clicar em um widget
    afeta todos os outros).
    """
    if not dados_disponiveis(nome_plano):
        return {"disponivel": False}

    df = _carregar(nome_plano)
    df_filtrado = _aplicar_filtros(df, filtros)

    total = len(df_filtrado)

    por_ano = sorted(
        _contagem(df_filtrado, "ano_inicio"),
        key=lambda x: x["chave"],
        reverse=True,
    )

    return {
        "disponivel": True,
        "total": total,
        "porAnoInicio": por_ano,
        "simples": _contagem(df_filtrado, "simples"),
        "mei": _contagem(df_filtrado, "mei"),
        "matrizFilial": _contagem(df_filtrado, "matriz_filial"),
        "porMunicipio": _contagem(df_filtrado, "municipio"),
        "porCapitalSocial": _contagem(df_filtrado, "faixa_capital_social"),
        "porCnae": [
            {"chave": cnae, "descricao": desc, "valor": int(v)}
            for (cnae, desc), v in (
                df_filtrado.groupby(["cnae_fiscal", "cnae"]).size().sort_values(ascending=False).items()
            )
        ],
        "porNaturezaJuridica": _contagem(df_filtrado, "natureza_juridica"),
    }


def _limpar_empregados(valor):
    """
    empregados_both_BI mistura números (vindos do RAIS, ex: "232.0") com
    faixas textuais de porte (ex: "01 a 09 (Micro Empresa)"). Números
    chegam com ".0" por terem passado por uma coluna float no pandas —
    aqui removemos esse sufixo para bater com o valor real ("232", não
    "232.0"), sem alterar os textos de faixa.
    """
    if valor is None:
        return None
    texto = str(valor)
    if texto.endswith(".0") and texto[:-2].replace("-", "").isdigit():
        return texto[:-2]
    return texto


def obter_lista_cnpj(nome_plano: str, filtros: dict) -> dict:
    """
    Lista uma linha por CNPJ — sem agregação — para a aba "Empregados por
    CNPJ": cnpj, razão social, número de empregados (RAIS quando exato,
    senão a faixa de porte), quantidade de sócios e município.

    Aceita os mesmos filtros de FILTROS_SUPORTADOS, para o caso de essa
    aba vir a se conectar ao cross-filter de "Dados do Setor" no futuro;
    hoje a tela chama sem filtros (lista completa).
    """
    if not dados_disponiveis(nome_plano):
        return {"disponivel": False}

    df = _carregar(nome_plano)
    df_filtrado = _aplicar_filtros(df, filtros)

    colunas = ["cnpj", "razao_social", "empregados_both_BI", "qtd_socios", "municipio"]
    df_view = df_filtrado[colunas].copy()
    df_view = df_view.where(pd.notna(df_view), None)

    linhas = [
        {
            "cnpj": row["cnpj"],
            "razaoSocial": row["razao_social"],
            "empregados": _limpar_empregados(row["empregados_both_BI"]),
            "socios": _limpar_empregados(row["qtd_socios"]),
            "municipio": row["municipio"],
        }
        for row in df_view.to_dict(orient="records")
    ]

    return {"disponivel": True, "total": len(linhas), "linhas": linhas}


# Rótulos de exibição para a coluna `porte`, na ordem em que devem
# aparecer no gráfico (do menor para o maior porte). A chave usada no
# filtro continua sendo o valor original da coluna ("Micro Empresa",
# "Empresa De Pequeno Porte", "Demais") — o rótulo é só para exibição.
PORTE_LABELS = {
    "Micro Empresa": "01 a 09 (Micro Empresa)",
    "Empresa De Pequeno Porte": "10 a 49 (Pequeno Porte)",
    "Demais": "Acima de 50 (Demais)",
}
PORTE_ORDEM = list(PORTE_LABELS.keys())


def obter_porte(nome_plano: str, filtros: dict) -> dict:
    """
    Conta o número de empresas por faixa de porte (coluna `porte`), para
    a aba "Empregados por Porte" — um gráfico de barras simples, sem
    cross-filter por agora.
    """
    if not dados_disponiveis(nome_plano):
        return {"disponivel": False}

    df = _carregar(nome_plano)
    df_filtrado = _aplicar_filtros(df, filtros)

    contagem = df_filtrado["porte"].value_counts()

    itens = [
        {"chave": porte, "label": PORTE_LABELS.get(porte, porte), "valor": int(contagem.get(porte, 0))}
        for porte in PORTE_ORDEM
    ]

    return {"disponivel": True, "total": len(df_filtrado), "porPorte": itens}