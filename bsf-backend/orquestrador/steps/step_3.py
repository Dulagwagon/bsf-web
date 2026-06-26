import pandas as pd

def run_step_3(caminho_csv):
    print(f"🔹 Step 3 - Processando saldo: {caminho_csv}")

    df = pd.read_csv(caminho_csv, dtype=str)

    print(f"📦 Total de registros carregados: {len(df)}")

    # 🔹 garante tipos corretos
    df["saldomovimentacao"] = pd.to_numeric(df["saldomovimentacao"], errors="coerce")
    df["competenciamov"] = df["competenciamov"].astype(str)

    # 🔹 remove possíveis nulos
    df = df.dropna(subset=["saldomovimentacao"])

    # =========================
    # 📊 CÁLCULO GERAL
    # =========================

    saldo_total = int(df["saldomovimentacao"].sum())

    admissoes = int((df["saldomovimentacao"] == 1).sum())
    desligamentos = int((df["saldomovimentacao"] == -1).sum())

    # =========================
    # 📊 CÁLCULO POR MÊS
    # =========================

    saldo_mensal = (
        df.groupby("competenciamov")["saldomovimentacao"]
        .sum()
        .reset_index()
        .rename(columns={"saldomovimentacao": "saldo"})
        .sort_values("competenciamov")
    )

    print("\n📊 RESUMO GERAL:")
    print(f"Admissões: {admissoes}")
    print(f"Desligamentos: {desligamentos}")
    print(f"Saldo total: {saldo_total}")

    print("\n📅 SALDO MENSAL:")
    print(saldo_mensal.head())
