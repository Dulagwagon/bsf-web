# BSF Backend

API Flask responsável por persistir os dados do Business Syndicate Framework
(CNAEs, Planos, Municípios) em arquivos JSON dentro de `data/`, e por
executar o pipeline de filtragem (orquestrador) que gera os resultados
finais por plano.

## Instalação

```bash
cd bsf-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Configuração do orquestrador

O pipeline lê as fontes RAIS e CAGED de caminhos locais, configuráveis por
variável de ambiente (o padrão assume a mesma máquina onde o Flask roda):

```bash
# opcional — só necessário se os caminhos forem diferentes do padrão
export BSF_RAIS_BASE="E:/NMN/DATA/RAIS"
export BSF_CAGED_PATH="E:/NMN/DATA/CAGED"
```

## Executar

```bash
python3 app.py
```

O servidor sobe em `http://localhost:5000`.

## Estrutura

```
bsf-backend/
├── app.py                  # ponto de entrada Flask
├── data/
│   ├── cnaes.json           # arquivo persistido — fonte de verdade dos CNAEs
│   ├── planos.json          # arquivo persistido — fonte de verdade dos Planos
│   └── municipios.json      # arquivo persistido — fonte de verdade dos Municípios
├── outputs/
│   └── <slug-do-plano>/     # gerado pelo orquestrador (pipeline) por plano
│       ├── rais_caged.csv
│       └── rais_caged_t.csv
├── orquestrador/
│   ├── pipeline_runner.py   # lógica de execução (RAIS + CAGED + consolidação)
│   └── steps/                # steps 1-4 do processamento (cópia idêntica dos
│                              # originais — não recebem dados via input/*.json,
│                              # apenas via parâmetros de função)
├── routes/
│   ├── cnaes.py             # endpoints REST de CNAEs
│   ├── planos.py            # endpoints REST de Planos
│   ├── municipios.py        # endpoints REST de Municípios
│   ├── resultados.py        # endpoints de listagem/download de resultados
│   ├── pipeline.py          # endpoints de execução do orquestrador
│   ├── fontes.py            # endpoints de upload/conversão das fontes RAIS/CAGED
│   └── paineis.py           # endpoint de dados estruturados para dashboards
├── services/
│   ├── storage.py           # leitura/escrita atômica de JSON (genérico)
│   ├── cnae_service.py      # validação e regras de negócio de CNAEs
│   ├── plano_service.py     # validação e regras de negócio de Planos
│   ├── municipio_service.py # validação e regras de negócio de Municípios
│   ├── resultado_service.py # localização/listagem de arquivos de resultado
│   ├── orquestrador_service.py # execução em background, logs, status
│   ├── fonte_service.py     # varredura, conversão txt→parquet, upload em chunks
│   └── painel_service.py    # leitura de rais_caged*.csv, estrutura dados p/ painéis
└── requirements.txt
```

## Endpoints

### CNAEs

| Método | Rota                | Descrição                              |
|--------|---------------------|-------------------------------------------|
| GET    | /api/health          | Verifica se o servidor está no ar       |
| GET    | /api/cnaes           | Lista todos os CNAEs                    |
| POST   | /api/cnaes           | Cria um novo CNAE                       |
| PUT    | /api/cnaes/\<id\>    | Atualiza um CNAE existente              |
| DELETE | /api/cnaes/\<id\>    | Remove um CNAE                          |
| POST   | /api/cnaes/import    | Importa uma lista de CNAEs em lote      |

### Planos

| Método | Rota                          | Descrição                                          |
|--------|-------------------------------|------------------------------------------------------|
| GET    | /api/planos                    | Lista todos os planos                               |
| POST   | /api/planos                    | Cria um novo plano                                  |
| PUT    | /api/planos/\<id\>             | Atualiza um plano existente                         |
| DELETE | /api/planos/\<id\>             | Remove um plano                                     |
| PATCH  | /api/planos/\<id\>/status      | Atualiza apenas o status (uso interno do pipeline)  |

### Municípios

| Método | Rota                            | Descrição                                          |
|--------|----------------------------------|------------------------------------------------------|
| GET    | /api/municipios                  | Lista todos os municípios                           |
| GET    | /api/municipios?estado=SP        | Lista apenas os municípios do estado informado      |
| POST   | /api/municipios                  | Cria um novo município                              |
| PUT    | /api/municipios/\<id\>           | Atualiza um município existente                     |
| DELETE | /api/municipios/\<id\>           | Remove um município                                 |
| POST   | /api/municipios/import           | Importa uma lista de municípios em lote             |

### Pipeline (orquestrador)

| Método | Rota                                   | Descrição                                          |
|--------|------------------------------------------|------------------------------------------------------|
| POST   | /api/pipeline/executar/\<plano_id\>       | Inicia execução completa (RAIS + CAGED)            |
| POST   | /api/pipeline/atualizar/\<plano_id\>      | Inicia atualização incremental (só CAGED recente)  |
| POST   | /api/pipeline/parar/\<plano_id\>          | Solicita interrupção (efetiva entre etapas)        |
| GET    | /api/pipeline/logs/\<plano_id\>?desde=N   | Logs novos a partir do índice N (cursor p/ polling)|
| GET    | /api/pipeline/status/\<plano_id\>         | Se está rodando ou não                             |

A execução roda em background (thread separada) e retorna imediatamente
(HTTP 202). O acompanhamento é feito via polling em `/logs` — o frontend
guarda o `total` retornado e usa como `desde` na próxima chamada, recebendo
só as linhas novas. O status detalhado do Plano (`running`/`done`/`error`
e a `etapa_atual`, ex: `"RAIS 2022"`) é atualizado em `data/planos.json`
durante a execução e pode ser lido via `GET /api/planos`.

### Fontes de Dados (RAIS/CAGED — upload e conversão para Parquet)

| Método | Rota                                              | Descrição                                  |
|--------|-----------------------------------------------------|-----------------------------------------------|
| GET    | /api/fontes                                          | Lista todos os arquivos RAIS/CAGED esperados, com status .txt/.parquet |
| POST   | /api/fontes/rais/\<regiao\>/\<ano\>/converter          | Inicia conversão .txt → .parquet (RAIS)     |
| POST   | /api/fontes/caged/\<ano\>/\<mes\>/converter            | Inicia conversão .txt → .parquet (CAGED)    |
| GET    | /api/fontes/conversao/\<chave\>/logs?desde=N           | Logs da conversão (cursor, igual ao pipeline) |
| DELETE | /api/fontes/rais/\<regiao\>/\<ano\>/txt                | Exclui o .txt original (irreversível)       |
| DELETE | /api/fontes/caged/\<ano\>/\<mes\>/txt                  | Exclui o .txt original (irreversível)       |
| POST   | /api/fontes/upload/iniciar                            | Inicia um upload em chunks                  |
| POST   | /api/fontes/upload/\<id\>/chunk                        | Envia um pedaço do arquivo                  |
| POST   | /api/fontes/upload/\<id\>/finalizar                    | Move o arquivo recebido para o destino final |
| POST   | /api/fontes/upload/\<id\>/cancelar                     | Descarta um upload em andamento             |

A conversão **preserva todas as colunas do arquivo original** — não filtra
nada, só troca o formato de armazenamento (texto → binário colunar com
compressão Snappy). O ganho de performance no pipeline vem de duas fontes:
o formato binário em si, e a leitura seletiva por coluna (`step_1`/`step_2`
passam a pedir só as 2-3 colunas usadas no filtro, em vez de carregar o
arquivo inteiro). Testes internos mostraram ganhos de ~10x no tempo de
filtragem, com o arquivo em disco ficando 70-95% menor.

`step_1` e `step_2` detectam automaticamente se existe um `.parquet` ao
lado do `.txt` esperado e usam-o preferencialmente; caso não exista, caem
para o `.txt` original sem nenhuma mudança de comportamento.

### Resultados

| Método | Rota                                         | Descrição                                  |
|--------|-----------------------------------------------|-----------------------------------------------|
| GET    | /api/resultados?plano=\<nome\>                 | Lista arquivos disponíveis para o plano      |
| GET    | /api/resultados/download?plano=\<nome\>&arquivo=\<x\> | Baixa um arquivo específico            |

### Formato do CNAE

```json
{
  "id": 1,
  "codigo": "6201501",
  "descricao": "Desenvolvimento de programas de computador sob encomenda",
  "secao": "J"
}
```

`codigo` deve ter exatamente 7 dígitos numéricos, sem máscara.

### Formato do Plano

```json
{
  "id": 1,
  "nome": "SP — Tecnologia",
  "regiao": "Sudeste",
  "estado": "SP",
  "cnaes": ["6201501", "6311900"],
  "municipios": ["355030", "350950"],
  "status": "idle",
  "etapa_atual": null
}
```

- `nome`: obrigatório, único (case-insensitive)
- `regiao`: **obrigatório**, uma de `Norte`, `Nordeste`, `Centro-Oeste`, `Sudeste`, `Sul` — usada pelo orquestrador para localizar a partição correta da fonte RAIS
- `estado`: opcional, sigla UF com 2 letras (obrigatório na prática para SP, já que SP tem partição própria na fonte RAIS, separada do resto do Sudeste)
- `cnaes`: lista de códigos com 7 dígitos (sem máscara); duplicados são removidos automaticamente
- `municipios`: lista de códigos IBGE com 6 dígitos (sem o dígito verificador)
- `status`: um de `idle`, `running`, `done`, `error` (padrão: `idle`)
- `etapa_atual`: string livre com a etapa em andamento (ex: `"RAIS 2022"`, `"CAGED 2026"`, `"Validação"`, `"Consolidação"`) — preenchida pelo orquestrador durante a execução, `null` fora dela

### Formato do Município

```json
{
  "id": 1,
  "estado": "SP",
  "nome": "São Paulo",
  "codigo": "355030"
}
```

- `estado`: obrigatório, sigla UF com 2 letras
- `nome`: obrigatório
- `codigo`: obrigatório, único, 6 dígitos numéricos (sem o dígito verificador)

### Resultados

Cada item retornado por `GET /api/resultados?plano=<nome>`:

```json
{
  "nome": "rais_caged.csv",
  "tamanho": 20480,
  "modificadoEm": 1782392466.79
}
```

- `nome`: nome do arquivo (sempre um de `rais_caged.csv` ou `rais_caged_t.csv`)
- `tamanho`: tamanho em bytes
- `modificadoEm`: timestamp Unix da última modificação

Os arquivos são localizados em `outputs/<slug-do-nome-do-plano>/`, onde o
slug é gerado a partir do nome do plano (acentos e caracteres especiais
removidos, espaços convertidos em hífen, tudo em minúsculas).
Ex: `"SP — Tecnologia"` → `outputs/sp-tecnologia/`

Essa pasta é responsabilidade do **orquestrador** (pipeline) — o backend
apenas localiza e serve os arquivos que já existirem ali. Se o pipeline
ainda não rodou para um plano, a lista de resultados vem vazia.

### Painéis

| Método | Rota                       | Descrição                                              |
|--------|------------------------------|-----------------------------------------------------------|
| GET    | /api/paineis/\<plano_id\>     | Dados estruturados (série temporal + tabela CNAE) para o dashboard do plano |

Lê `rais_caged.csv` e `rais_caged_t.csv` (gerados pelo pipeline) e devolve
JSON já processado — o CSV bruto nunca é exposto pela API. Pensado para
crescer: cada gráfico/tabela do dashboard Power BI original ganha sua
própria função em `services/painel_service.py` (hoje: série temporal de
vínculos totais por ano, e tabela de vínculos por CNAE × ano).

```json
{
  "disponivel": true,
  "plano": { "id": 1, "nome": "125 - SINDASSEIO", "estado": "RS", "regiao": "Sul" },
  "serieTemporal": [{ "ano": "2021", "totalVinculos": 614728 }, ...],
  "tabelaCnae": [
    { "cnae": "4711302", "descricao": "...", "valores": { "2021": 71179, ... } },
    ...
  ]
}
```

Se os CSVs ainda não existirem para o plano, retorna `"disponivel": false`
— o frontend mostra um estado vazio orientando a executar o pipeline,
em vez de tratar isso como erro.

## Próximos passos

O orquestrador já está integrado (RAIS + CAGED + consolidação, executando
em background com logs e status em tempo real), o módulo de Fontes
permite upload/conversão para Parquet, e o módulo de Painéis expõe os
dois primeiros gráficos do dashboard original (substituto gradual do
Power BI). Possíveis evoluções futuras:
- Replicar as demais abas do dashboard Power BI como novos blocos em
  `painel_service.py` + `Paineis.jsx` (a estrutura já foi pensada para isso)
- Suporte a múltiplas execuções/conversões simultâneas (hoje o estado de
  logs/cancelamento vive em memória do processo Flask, adequado para um
  operador por vez)
- Persistir histórico de execuções (datas, duração, registros gerados) para
  alimentar métricas reais no Dashboard
- Mover RAIS_BASE/CAGED_PATH para um armazenamento mais robusto que variáveis
  de ambiente, caso o backend migre para um servidor separado das fontes de dados
- Conversão em lote (todos os `.txt` pendentes de uma vez) na tela Fontes,
  hoje feita um arquivo por vez