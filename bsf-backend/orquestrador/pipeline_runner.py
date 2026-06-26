"""
Executor do pipeline de filtragem (RAIS + CAGED).

Esta é uma adaptação de pipeline_service.py: a lógica de processamento
(steps 1 a 4) é idêntica, mas a origem dos dados muda — em vez de ler
input/planos.json e input/cnaes.json, este módulo recebe os dados do
Plano (cnaes, municipios, regiao, estado) e o catálogo de CNAEs
diretamente como parâmetros, vindos da API do backend (data/planos.json
e data/cnaes.json), que é a fonte única de verdade deste projeto.

Se no futuro o orquestrador precisar rodar de forma totalmente
independente (outro projeto, outra máquina), ele pode continuar usando
pipeline_service.py original sem nenhuma mudança — este módulo aqui é
específico da integração com o BSF.
"""
import os

from orquestrador.steps.step_1 import run_step_1
from orquestrador.steps.step_2 import run_step_2_caged
from orquestrador.steps.step_3 import run_step_3
from orquestrador.steps.step_4 import run_step_4

# =========================
# CONFIG DE INFRAESTRUTURA
# =========================
# Caminhos locais da máquina onde o Flask roda. Por enquanto a mesma
# máquina onde estão as fontes RAIS/CAGED — ajustável via variável de
# ambiente para quando isso migrar para um servidor dedicado.
RAIS_BASE = os.environ.get("BSF_RAIS_BASE", "E:/NMN/DATA/RAIS")
CAGED_PATH = os.environ.get("BSF_CAGED_PATH", "E:/NMN/DATA/CAGED")

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

ANOS_RAIS = [2021, 2022, 2023, 2024]
ANOS_CAGED = [2025, 2026]


# =========================
# RESOLUÇÃO DA PARTIÇÃO RAIS
# =========================
def resolver_regiao_dados(plano: dict) -> str:
    """
    A fonte RAIS é particionada por região oficial do IBGE, exceto SP,
    que tem partição própria (separada do resto do Sudeste).

    plano["regiao"] já é a região oficial (Norte/Nordeste/Centro-Oeste/
    Sudeste/Sul) cadastrada no Plano — aqui só tratamos a exceção de SP.
    """
    if plano.get("estado") == "SP":
        return "SP"
    return (plano.get("regiao") or "").upper()


def montar_cnaes_dict(cnaes_codigos: list, catalogo_cnaes: list) -> dict:
    """
    Monta o {codigo: descricao} esperado pelo step 4, a partir da lista
    de códigos do Plano e do catálogo completo de CNAEs (data/cnaes.json).
    Códigos sem descrição cadastrada usam o próprio código como fallback,
    para não quebrar a execução — mas idealmente o catálogo deve estar
    completo antes de rodar.
    """
    catalogo_por_codigo = {c["codigo"]: c["descricao"] for c in catalogo_cnaes}
    return {
        codigo: catalogo_por_codigo.get(codigo, codigo)
        for codigo in cnaes_codigos
    }


def preparar_ambiente(plano: dict, catalogo_cnaes: list) -> dict:
    """
    Monta a configuração de execução a partir dos dados do Plano (vindos
    da API) e do catálogo de CNAEs — equivalente ao preparar_ambiente()
    original, mas sem nenhuma leitura de arquivo input/*.json.
    """
    regiao_dados = resolver_regiao_dados(plano)
    output_plano = os.path.join(OUTPUTS_DIR, _slugify(plano["nome"]))
    os.makedirs(output_plano, exist_ok=True)

    return {
        "plano": plano["nome"],
        "cnaes": plano["cnaes"],
        "municipios": plano["municipios"],
        "cnaes_dict": montar_cnaes_dict(plano["cnaes"], catalogo_cnaes),
        "regiao_dados": regiao_dados,
        "rais_path": f"{RAIS_BASE}/{regiao_dados}",
        "caged_path": CAGED_PATH,
        "output_plano": output_plano,
    }


def _slugify(nome: str) -> str:
    """Mesmo slug usado por resultado_service.py, para os caminhos baterem."""
    import re
    import unicodedata
    nome = unicodedata.normalize("NFKD", nome or "")
    nome = nome.encode("ascii", "ignore").decode("ascii")
    nome = nome.lower().strip()
    nome = re.sub(r"[^a-z0-9]+", "-", nome)
    nome = re.sub(r"-+", "-", nome).strip("-")
    return nome or "plano"


# =========================
# EXECUÇÃO COMPLETA
# =========================
def executar_full(plano: dict, catalogo_cnaes: list, on_log=None, on_etapa=None, stop_flag=None):
    """
    Roda o pipeline completo (RAIS 4 anos + CAGED 2 anos + validação +
    consolidação) para um Plano.

    on_log(str): callback chamado a cada linha de log gerada.
    on_etapa(str): callback chamado a cada troca de etapa (ex: "RAIS 2022").
    stop_flag(): callable que retorna True se a execução deve ser interrompida
                 (checado apenas entre etapas, não no meio de uma).

    Levanta a exceção original em caso de erro — quem chama decide como
    reportar (ex: marcar o Plano como "error" e logar o traceback).
    """
    def log(msg):
        print(msg)
        if on_log:
            on_log(msg)

    def etapa(nome):
        if on_etapa:
            on_etapa(nome)

    config = preparar_ambiente(plano, catalogo_cnaes)

    CNAE = config["cnaes"]
    MUNICIPIO = config["municipios"]
    RAIS_PATH = config["rais_path"]
    CAGED_PATH_LOCAL = config["caged_path"]
    OUTPUT_PLANO = config["output_plano"]
    cnaes_dict = config["cnaes_dict"]

    log(f"📋 Plano: {config['plano']}")
    log(f"📍 Partição de dados: {config['regiao_dados']}")
    log(f"📁 Output: {OUTPUT_PLANO}")
    log(f"🏷️ CNAEs: {len(CNAE)}")
    log(f"🏙️ Municípios: {len(MUNICIPIO)}")

    # STEP 1 - RAIS
    log("\n🔷 ETAPA 1 - RAIS")
    for ano in ANOS_RAIS:
        if stop_flag and stop_flag():
            log("⛔ Pipeline interrompido")
            return {"interrompido": True}

        etapa(f"RAIS {ano}")
        log(f"\n📅 Processando RAIS {ano}")

        caminho = f"{RAIS_PATH}/{ano}/rais_{ano}.txt"
        df = run_step_1(caminho_rais=caminho, cnae_alvo=CNAE, municipio_alvo=MUNICIPIO)
        df.to_csv(f"{OUTPUT_PLANO}/filtrado_{ano}.csv", index=False)
        log(f"✅ RAIS {ano}: {len(df)} registros filtrados")

    # STEP 2 - CAGED
    log("\n🔷 ETAPA 2 - CAGED")
    for ano in ANOS_CAGED:
        if stop_flag and stop_flag():
            log("⛔ Pipeline interrompido")
            return {"interrompido": True}

        etapa(f"CAGED {ano}")
        log(f"\n📅 Processando CAGED {ano}")

        df = run_step_2_caged(base_path=CAGED_PATH_LOCAL, ano=ano, cnae_alvo=CNAE, municipio_alvo=MUNICIPIO)
        saida = f"{OUTPUT_PLANO}/caged_{ano}.csv"
        df.to_csv(saida, index=False)
        log(f"✅ CAGED {ano}: {len(df)} registros filtrados")

    # STEP 3 - VALIDAÇÃO
    etapa("Validação")
    log("\n🔷 ETAPA 3 - VALIDAÇÃO CAGED")
    for ano in ANOS_CAGED:
        caminho = f"{OUTPUT_PLANO}/caged_{ano}.csv"
        if os.path.exists(caminho) and os.path.getsize(caminho) > 0:
            log(f"\n📊 Validando {ano}")
            run_step_3(caminho)
        else:
            log(f"⚠️ Arquivo vazio ou inexistente: {caminho}")

    # STEP 4 - CONSOLIDAÇÃO
    etapa("Consolidação")
    log("\n🔷 ETAPA 4 - CONSOLIDAÇÃO FINAL")

    df_final, df_t = run_step_4(cnaes_dict=cnaes_dict, pasta_output=OUTPUT_PLANO)

    # FILTROS FINAIS
    df_final = df_final[df_final["cnae_fiscal"].isin(CNAE)].reset_index(drop=True)

    map_desc = dict(zip(df_final["cnae_fiscal"], df_final["cnae"]))
    descricoes = [map_desc[c] for c in CNAE if c in map_desc]
    colunas_validas = ["ano"] + descricoes
    df_t = df_t[colunas_validas]

    df_t["total_vinculos"] = df_t.drop(columns=["ano"]).sum(axis=1)

    # SALVANDO
    saida_final = f"{OUTPUT_PLANO}/rais_caged.csv"
    df_final.to_csv(saida_final, index=False, sep=";")

    saida_t = f"{OUTPUT_PLANO}/rais_caged_t.csv"
    df_t.to_csv(saida_t, index=False, sep=";")

    log("\n✅ PIPELINE FINALIZADO COM SUCESSO")
    log(f"📁 Arquivo final: {saida_final}")
    log(f"📁 Arquivo transposto: {saida_t}")

    return {"arquivo_final": saida_final, "arquivo_transposto": saida_t}


# =========================
# ATUALIZAÇÃO INCREMENTAL
# =========================
def executar_update(plano: dict, catalogo_cnaes: list, on_log=None, on_etapa=None, stop_flag=None):
    """
    Roda apenas a atualização incremental: reprocessa o CAGED do ano mais
    recente (2026) e refaz a consolidação final, sem tocar nos 4 anos de
    RAIS já processados.
    """
    def log(msg):
        print(msg)
        if on_log:
            on_log(msg)

    def etapa(nome):
        if on_etapa:
            on_etapa(nome)

    config = preparar_ambiente(plano, catalogo_cnaes)

    CNAE = config["cnaes"]
    MUNICIPIO = config["municipios"]
    CAGED_PATH_LOCAL = config["caged_path"]
    OUTPUT_PLANO = config["output_plano"]
    cnaes_dict = config["cnaes_dict"]

    log(f"📋 Plano: {config['plano']}")
    log("\n🔄 UPDATE INCREMENTAL")

    if stop_flag and stop_flag():
        log("⛔ Pipeline interrompido")
        return {"interrompido": True}

    etapa("CAGED 2026")
    log("\n🔷 ETAPA 2 - CAGED 2026")

    df = run_step_2_caged(base_path=CAGED_PATH_LOCAL, ano=2026, cnae_alvo=CNAE, municipio_alvo=MUNICIPIO)
    saida = f"{OUTPUT_PLANO}/caged_2026.csv"
    df.to_csv(saida, index=False)
    log(f"✅ CAGED 2026: {len(df)} registros filtrados")

    etapa("Validação")
    log("\n🔷 ETAPA 3 - VALIDAÇÃO")
    if os.path.exists(saida) and os.path.getsize(saida) > 0:
        run_step_3(saida)
    else:
        log(f"⚠️ Arquivo vazio ou inexistente: {saida}")

    etapa("Consolidação")
    log("\n🔷 ETAPA 4 - CONSOLIDAÇÃO FINAL")

    df_final, df_t = run_step_4(cnaes_dict=cnaes_dict, pasta_output=OUTPUT_PLANO)

    df_final = df_final[df_final["cnae_fiscal"].isin(CNAE)].reset_index(drop=True)

    map_desc = dict(zip(df_final["cnae_fiscal"], df_final["cnae"]))
    descricoes = [map_desc[c] for c in CNAE if c in map_desc]
    colunas_validas = ["ano"] + descricoes
    df_t = df_t[colunas_validas]

    df_t["total_vinculos"] = df_t.drop(columns=["ano"]).sum(axis=1)

    saida_final = f"{OUTPUT_PLANO}/rais_caged.csv"
    df_final.to_csv(saida_final, index=False, sep=";")

    saida_t = f"{OUTPUT_PLANO}/rais_caged_t.csv"
    df_t.to_csv(saida_t, index=False, sep=";")

    log("\n✅ UPDATE FINALIZADO COM SUCESSO")
    log(f"📁 Arquivo final: {saida_final}")
    log(f"📁 Arquivo transposto: {saida_t}")

    return {"arquivo_final": saida_final, "arquivo_transposto": saida_t}