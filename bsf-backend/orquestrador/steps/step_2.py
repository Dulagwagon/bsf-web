#============================================
#   STEP 2 - PROCESSAMENTO DO CAGED(MENSAL)
#============================================

import pandas as pd
import unicodedata
import os
import re


def normalizar_coluna(texto):
    try:
        texto = texto.encode('latin1').decode('utf-8')
    except:
        pass

    texto = ''.join(
        c for c in unicodedata.normalize('NFKD', texto)
        if not unicodedata.combining(c)
    )

    texto = texto.lower().strip()
    texto = re.sub(r'[^a-z0-9]', '_', texto)
    texto = re.sub(r'_+', '_', texto)

    return texto


def _detectar_colunas_caged(columns_normalizadas):
    coluna_cnae = next((c for c in columns_normalizadas if "subclasse" in c), None)
    if coluna_cnae is None:
        print("❌ CNAE não encontrado")
        print(columns_normalizadas)
        raise IndexError

    coluna_municipio = next(
        (c for c in columns_normalizadas if "municipio" in c or "codemun" in c),
        None
    )
    if coluna_municipio is None:
        print("❌ Município não encontrado")
        print(columns_normalizadas)
        raise KeyError

    return coluna_cnae, coluna_municipio


def _filtrar_chunk_caged(chunk, coluna_cnae, coluna_municipio, cnae_alvo, municipio_alvo):
    chunk[coluna_cnae] = chunk[coluna_cnae].astype(str).str.strip()
    chunk[coluna_municipio] = chunk[coluna_municipio].astype(str).str.strip()

    if isinstance(cnae_alvo, list):
        filtrado = chunk[chunk[coluna_cnae].isin(cnae_alvo)]
    else:
        filtrado = chunk[chunk[coluna_cnae] == cnae_alvo]

    if isinstance(municipio_alvo, list):
        filtrado = filtrado[filtrado[coluna_municipio].isin(municipio_alvo)]
    else:
        filtrado = filtrado[filtrado[coluna_municipio] == municipio_alvo]

    return filtrado


def run_step_2_caged(base_path, ano, cnae_alvo, municipio_alvo):
    """
    Lê e filtra o CAGED mês a mês. Para cada mês, se existir um .parquet
    equivalente (mesma pasta, caged_{ano}_{mes}.parquet), ele é usado
    preferencialmente. Caso contrário, cai para o .txt original.
    A lógica de filtro (CNAE, município) é idêntica nos dois caminhos.
    """
    print(f"🔹 Step 2 - CAGED {ano}")

    resultados = []
    total_linhas = 0
    total_filtradas = 0

    if isinstance(cnae_alvo, list):
        cnae_alvo = [str(c).strip() for c in cnae_alvo]
    else:
        cnae_alvo = str(cnae_alvo).strip()

    if isinstance(municipio_alvo, list):
        municipio_alvo = [str(m).strip() for m in municipio_alvo]
    else:
        municipio_alvo = str(municipio_alvo).strip()

    for mes in range(1, 13):
        mes_str = str(mes).zfill(2)
        caminho_txt = f"{base_path}/{ano}/caged_{ano}_{mes_str}.txt"
        caminho_parquet = f"{base_path}/{ano}/caged_{ano}_{mes_str}.parquet"

        if os.path.exists(caminho_parquet):
            # =========================
            # 🚀 CAMINHO RÁPIDO: PARQUET
            # =========================
            print(f"⚡ Usando Parquet: {caminho_parquet}")

            import pyarrow.parquet as pq

            schema_cols = pq.ParquetFile(caminho_parquet).schema_arrow.names
            colunas_normalizadas = [normalizar_coluna(c) for c in schema_cols]
            mapa_colunas = dict(zip(colunas_normalizadas, schema_cols))

            coluna_cnae_norm, coluna_municipio_norm = _detectar_colunas_caged(colunas_normalizadas)
            colunas_originais_necessarias = [
                mapa_colunas[coluna_cnae_norm],
                mapa_colunas[coluna_municipio_norm],
            ]

            df = pd.read_parquet(caminho_parquet, columns=colunas_originais_necessarias)
            df.columns = [normalizar_coluna(c) for c in df.columns]

            total_linhas += len(df)
            filtrado = _filtrar_chunk_caged(df, coluna_cnae_norm, coluna_municipio_norm, cnae_alvo, municipio_alvo)
            total_filtradas += len(filtrado)

            if not filtrado.empty:
                resultados.append(filtrado)

        elif os.path.exists(caminho_txt):
            # =========================
            # 🐢 CAMINHO ORIGINAL: TXT EM CHUNKS
            # =========================
            print(f"📅 Processando {ano}-{mes_str}")

            for chunk in pd.read_csv(
                caminho_txt,
                sep=";",
                dtype=str,
                encoding="cp1252",
                chunksize=250_000,
                low_memory=False
            ):
                chunk.columns = [normalizar_coluna(col) for col in chunk.columns]
                coluna_cnae, coluna_municipio = _detectar_colunas_caged(list(chunk.columns))

                total_linhas += len(chunk)

                filtrado = _filtrar_chunk_caged(chunk, coluna_cnae, coluna_municipio, cnae_alvo, municipio_alvo)
                total_filtradas += len(filtrado)

                if not filtrado.empty:
                    resultados.append(filtrado)

        else:
            print(f"⚠️ Arquivo não encontrado: {caminho_txt}")
            continue

        print(f"📦 Acumulado: {total_linhas:,} | Filtradas: {total_filtradas:,}")

    print("🔹 Consolidando resultados CAGED...")

    if resultados:
        df_final = pd.concat(resultados, ignore_index=True)
    else:
        df_final = pd.DataFrame()

    print(f"✅ Total final CAGED {ano}: {len(df_final)} linhas\n")

    return df_final