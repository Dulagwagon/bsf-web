#============================================
#   STEP 1 - PROCESSAMENTO DA RAIS(ANUAL)
#============================================

import os
import pandas as pd
import unicodedata

def remover_acentos(texto):
    return ''.join(
        c for c in unicodedata.normalize('NFKD', texto)
        if not unicodedata.combining(c)
    )

def _padronizar_colunas(columns):
    return [
        remover_acentos(col)
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("/", "_")
        for col in columns
    ]

def _detectar_colunas(columns_padronizadas):
    """
    Detecta as 3 colunas usadas no filtro (cnae, municipio, vinculo) a
    partir de uma lista de nomes já padronizados. Mesma lógica original,
    fatorada para ser usada tanto no caminho .parquet quanto .txt.
    """
    coluna_cnae = next((c for c in columns_padronizadas if "cnae" in c and "subclasse" in c), None)

    colunas_municipio_validas = ["municipio", "municipio_-_codigo"]
    coluna_municipio = next((c for c in colunas_municipio_validas if c in columns_padronizadas), None)

    colunas_vinculo = ["vinculo_ativo_31_12", "ind_vinculo_ativo_31_12_-_codigo"]
    coluna_vinculo = next((c for c in colunas_vinculo if c in columns_padronizadas), None)

    if coluna_cnae is None or coluna_municipio is None or coluna_vinculo is None:
        print("❌ Colunas obrigatórias não encontradas")
        print(columns_padronizadas)
        raise KeyError

    return coluna_cnae, coluna_municipio, coluna_vinculo


def _filtrar_chunk(chunk, coluna_cnae, coluna_municipio, coluna_vinculo, cnae_alvo, municipio_alvo):
    chunk[coluna_cnae] = chunk[coluna_cnae].astype(str).str.strip()
    chunk[coluna_municipio] = chunk[coluna_municipio].astype(str).str.strip()
    chunk[coluna_vinculo] = chunk[coluna_vinculo].astype(str).str.strip()

    # CNAE
    if isinstance(cnae_alvo, list):
        filtrado = chunk[chunk[coluna_cnae].isin(cnae_alvo)]
    else:
        filtrado = chunk[chunk[coluna_cnae] == cnae_alvo]

    # MUNICÍPIO
    if isinstance(municipio_alvo, list):
        filtrado = filtrado[filtrado[coluna_municipio].isin(municipio_alvo)]
    else:
        filtrado = filtrado[filtrado[coluna_municipio] == municipio_alvo]

    # VÍNCULO ATIVO
    filtrado = filtrado[filtrado[coluna_vinculo] == "1"]

    return filtrado


def run_step_1(caminho_rais, cnae_alvo, municipio_alvo):
    """
    Lê e filtra a base RAIS. Se existir um .parquet equivalente ao
    caminho_rais informado (mesma pasta/ano, extensão .parquet), ele é
    usado preferencialmente — leitura bem mais rápida, e busca apenas as
    3 colunas necessárias ao filtro. Caso contrário, cai para o .txt
    original (mesmo comportamento de sempre).

    A lógica de filtro em si (CNAE, município, vínculo ativo) é idêntica
    nos dois caminhos — só a forma de leitura muda.
    """
    print("🔹 Step 1 - Iniciando leitura")

    # 🔹 padroniza inputs
    if isinstance(cnae_alvo, list):
        cnae_alvo = [str(c).strip() for c in cnae_alvo]
    else:
        cnae_alvo = str(cnae_alvo).strip()

    if isinstance(municipio_alvo, list):
        municipio_alvo = [str(m).strip() for m in municipio_alvo]
    else:
        municipio_alvo = str(municipio_alvo).strip()

    caminho_parquet = os.path.splitext(caminho_rais)[0] + ".parquet"
    total_linhas = 0
    total_filtradas = 0
    resultados = []

    if os.path.isfile(caminho_parquet):
        # =========================
        # 🚀 CAMINHO RÁPIDO: PARQUET
        # =========================
        print(f"⚡ Usando Parquet: {caminho_parquet}")

        import pyarrow.parquet as pq

        schema_cols = pq.ParquetFile(caminho_parquet).schema_arrow.names
        colunas_padronizadas = _padronizar_colunas(schema_cols)
        mapa_colunas = dict(zip(colunas_padronizadas, schema_cols))

        coluna_cnae_pad, coluna_municipio_pad, coluna_vinculo_pad = _detectar_colunas(colunas_padronizadas)
        colunas_originais_necessarias = [
            mapa_colunas[coluna_cnae_pad],
            mapa_colunas[coluna_municipio_pad],
            mapa_colunas[coluna_vinculo_pad],
        ]

        df = pd.read_parquet(caminho_parquet, columns=colunas_originais_necessarias)
        df.columns = _padronizar_colunas(df.columns)

        total_linhas = len(df)
        filtrado = _filtrar_chunk(df, coluna_cnae_pad, coluna_municipio_pad, coluna_vinculo_pad, cnae_alvo, municipio_alvo)
        total_filtradas = len(filtrado)

        if not filtrado.empty:
            resultados.append(filtrado)

        print(f"📦 Processado: {total_linhas:,} | Filtradas: {total_filtradas:,}")

    else:
        # =========================
        # 🐢 CAMINHO ORIGINAL: TXT EM CHUNKS
        # =========================
        print(f"📄 Usando TXT (Parquet não encontrado): {caminho_rais}")

        chunksize = 500_000

        for chunk in pd.read_csv(
            caminho_rais,
            sep=";",
            dtype=str,
            encoding="latin1",
            chunksize=chunksize,
            low_memory=False
        ):
            chunk.columns = _padronizar_colunas(chunk.columns)

            try:
                coluna_cnae, coluna_municipio, coluna_vinculo = _detectar_colunas(list(chunk.columns))
            except KeyError:
                raise

            total_linhas += len(chunk)

            filtrado = _filtrar_chunk(chunk, coluna_cnae, coluna_municipio, coluna_vinculo, cnae_alvo, municipio_alvo)
            total_filtradas += len(filtrado)

            if not filtrado.empty:
                resultados.append(filtrado)

            print(f"📦 Processado: {total_linhas:,} | Filtradas: {total_filtradas:,}")

    print("🔹 Consolidando resultados...")

    if resultados:
        df_final = pd.concat(resultados, ignore_index=True)
    else:
        df_final = pd.DataFrame()

    print(f"✅ Total final: {len(df_final)} linhas\n")

    return df_final