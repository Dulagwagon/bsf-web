# BSF Backend

API Flask responsável por persistir os dados do Business Syndicate Framework
(CNAEs, e futuramente Planos e o próprio pipeline de filtragem) em arquivos
JSON dentro de `data/`.

## Instalação

```bash
cd bsf-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
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
│   └── planos.json          # arquivo persistido — fonte de verdade dos Planos
├── routes/
│   ├── cnaes.py             # endpoints REST de CNAEs
│   └── planos.py            # endpoints REST de Planos
├── services/
│   ├── storage.py           # leitura/escrita atômica de JSON (genérico)
│   ├── cnae_service.py      # validação e regras de negócio de CNAEs
│   └── plano_service.py     # validação e regras de negócio de Planos
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
  "status": "idle"
}
```

- `nome`: obrigatório, único (case-insensitive)
- `regiao`: opcional, uma de `Norte`, `Nordeste`, `Centro-Oeste`, `Sudeste`, `Sul`
- `estado`: opcional, sigla UF com 2 letras
- `cnaes`: lista de códigos com 7 dígitos (sem máscara); duplicados são removidos automaticamente
- `municipios`: lista de códigos IBGE com 6 dígitos (sem o dígito verificador)
- `status`: um de `idle`, `running`, `done`, `error` (padrão: `idle`)

## Próximos passos

Este backend vai crescer para incluir:
- Endpoint de **execução do pipeline**, que lerá `cnaes.json` + `planos.json`
  para filtrar a base de dados de empresas, atualizando o `status` do plano
  via `PATCH /api/planos/<id>/status` durante a execução