import pandas as pd

def gerar_tabela_transposta_csv(caminho_csv):
    df = pd.read_csv(caminho_csv, sep=";")

    anos = ["2021","2022","2023","2024","2025","2026"]

    data = []

    for ano in anos:
        linha = {"ano": ano}

        for _, row in df.iterrows():
            coluna = row["cnae"]
            linha[coluna] = row[str(ano)]

        data.append(linha)

    df_t = pd.DataFrame(data)

    return df_t


def run_step_4(cnaes_dict, pasta_output):
    print("🔹 Step 4 - Consolidação com estoque acumulado")

    # =========================
    # 📥 CNAE (VINDO DO JSON)
    # =========================
    df_cnae = pd.DataFrame({
        "cnae_fiscal": list(cnaes_dict.keys()),
        "cnae": list(cnaes_dict.values())
    })

    df_cnae["cnae_fiscal"] = df_cnae["cnae_fiscal"].astype(str).str.strip()

    df_final = df_cnae.copy()

    # =========================
    # 📊 RAIS (ESTOQUE)
    # =========================
    for ano in [2021, 2022, 2023, 2024]:
        caminho = f"{pasta_output}/filtrado_{ano}.csv"
        df = pd.read_csv(caminho, dtype=str)

        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
            .str.replace(" ", "_")
)

        colunas_validas = [
            "cnae_2.0_subclasse",
            "cnae_2_0_subclasse",
            "cnae_2.0_subclasse_-_codigo",
            "cnae_2_0_subclasse_codigo"
        ]

        coluna_cnae = None
        for col in colunas_validas:
            if col in df.columns:
                coluna_cnae = col
                break

        if coluna_cnae is None:
            print("❌ Coluna CNAE subclasse não encontrada")
            print(df.columns.tolist())
            raise KeyError

        df[coluna_cnae] = df[coluna_cnae].astype(str).str.strip()

        contagem = df[coluna_cnae].value_counts()

        df_final[str(ano)] = (
            df_final["cnae_fiscal"]
            .map(contagem)
            .fillna(0)
        )

    # =========================
    # 📊 CAGED (FLUXO)
    # =========================
    saldos = {}

    for ano in [2025, 2026]:
        caminho = f"{pasta_output}/caged_{ano}.csv"
        df = pd.read_csv(caminho, dtype=str)

        df["subclasse"] = df["subclasse"].astype(str).str.strip()
        df["saldomovimentacao"] = pd.to_numeric(df["saldomovimentacao"], errors="coerce")

        saldo = df.groupby("subclasse")["saldomovimentacao"].sum()
        saldos[ano] = saldo

    # =========================
    # 🔥 ACUMULAÇÃO
    # =========================
    df_final["2024"] = pd.to_numeric(df_final["2024"], errors="coerce").fillna(0)

    df_final["2025"] = (
        df_final["2024"] +
        df_final["cnae_fiscal"].map(saldos[2025]).fillna(0)
    )

    df_final["2026"] = (
        df_final["2025"] +
        df_final["cnae_fiscal"].map(saldos[2026]).fillna(0)
    )

    # =========================
    # 🧹 LIMPEZA FINAL
    # =========================
    df_final = df_final.fillna(0)

    for ano in ["2021","2022","2023","2024","2025","2026"]:
        df_final[ano] = df_final[ano].astype(int)

    df_final = df_final[
        ["cnae_fiscal", "2021", "2022", "2023", "2024", "2025", "2026", "cnae"]
    ]

    # =========================
    # 💾 SALVA CSV PRINCIPAL
    # =========================
    caminho_saida = f"{pasta_output}/rais_caged.csv"
    df_final.to_csv(caminho_saida, index=False, sep=";")

    # =========================
    # 🔄 GERA TRANSPOSTO
    # =========================
    df_t = gerar_tabela_transposta_csv(caminho_saida)

    print("✅ Consolidação finalizada com sucesso")

    return df_final, df_t