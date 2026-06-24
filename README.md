# BSF

> Business Signal Framework

Plataforma de inteligência territorial e setorial desenvolvida para transformar grandes volumes de dados públicos brasileiros em informações estratégicas para análise de mercado, prospecção comercial e monitoramento econômico.

O BSF integra bases como RAIS, Novo CAGED, CNAE e IBGE para gerar indicadores, séries históricas e análises segmentadas por atividade econômica e localização geográfica.

---

## Visão Geral

O objetivo do BSF é permitir que gestores, analistas, pesquisadores e equipes comerciais identifiquem oportunidades de mercado através da combinação de dados econômicos, territoriais e trabalhistas.

A plataforma permite:

- Criar planos de monitoramento personalizados;
- Filtrar segmentos econômicos por CNAE;
- Selecionar municípios e regiões de interesse;
- Executar pipelines de processamento;
- Consolidar informações de diferentes bases públicas;
- Gerar indicadores e resultados para tomada de decisão.

---

## Funcionalidades

### Dashboard

Painel executivo para acompanhamento da operação.

**Recursos atuais:**

- Indicadores operacionais
- Monitoramento de pipelines
- Histórico de atividades
- Cobertura territorial
- Resumo de planos cadastrados

---

### Gestão de Planos

Módulo responsável pela criação e administração dos planos de monitoramento.

**Recursos atuais:**

- Cadastro de planos
- Edição de planos
- Seleção de CNAEs
- Seleção de municípios
- Configuração regional
- Controle de status
- Integração Frontend ↔ Backend
- Edição de CNAEs através da API

---

### Pipeline

Módulo de processamento responsável pela execução das etapas de transformação dos dados.

**Recursos atuais:**

- Seleção de plano
- Execução manual
- Execução incremental
- Logs de execução
- Controle de progresso
- Monitoramento de status

---

### Resultados *(em desenvolvimento)*

- Consolidação RAIS + CAGED
- Indicadores econômicos
- Evolução histórica
- Rankings territoriais
- Exportação CSV
- Exportação Excel

---

## Arquitetura

### Frontend

```text
React
Vite
CSS Modules
React Router
```

### Backend

```text
Python
Flask
SQLAlchemy
```

### Banco de Dados

```text
PostgreSQL
```

---

## Estrutura do Projeto

```text
bsf/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── styles/
│
├── backend/
│   ├── api/
│   ├── services/
│   ├── pipelines/
│   ├── models/
│   ├── database/
│   └── app.py
│
├── data/
│   ├── raw/
│   ├── processed/
│   └── exports/
│
└── docs/
```

---

## Pipeline de Dados

Fluxo atual previsto para processamento:

```text
RAIS
 ↓
Tratamento
 ↓
CAGED
 ↓
Consolidação
 ↓
Base Final
 ↓
Resultados
```

### Etapas

```text
step_1.py → Processamento da RAIS
step_2.py → Processamento do Novo CAGED
step_3.py → Consolidação das movimentações
step_4.py → Geração das bases finais
```

---

## Modelo Conceitual

### Plano

```text
Plano
 ├── Nome
 ├── Estado
 ├── Região
 ├── CNAEs
 ├── Municípios
 ├── Status
 └── Datas
```

### Execução

```text
Execução
 ├── Plano
 ├── Status
 ├── Progresso
 ├── Logs
 ├── Data de Início
 └── Data de Conclusão
```

---

## Fontes de Dados

Atualmente o projeto está estruturado para trabalhar com:

- RAIS
- Novo CAGED
- CNAE 2.0
- Municípios IBGE
- Bases territoriais complementares

---

## Status Atual

Atualmente o projeto já possui:

- ✅ Interface completa em React
- ✅ Sistema de autenticação
- ✅ Dashboard funcional
- ✅ Gestão de planos
- ✅ Backend Flask operacional
- ✅ API de gerenciamento de CNAEs
- ✅ Integração Frontend ↔ Backend
- ✅ Tema Dark/Light
- ✅ Estrutura inicial do Pipeline
- 🚧 Integração completa dos ETLs em desenvolvimento

---

## Roadmap

### MVP

- [x] Interface de Login
- [x] Dashboard
- [x] Gestão de Planos
- [x] Backend Flask
- [x] API de CNAEs
- [x] Integração Frontend ↔ Backend
- [ ] Persistência PostgreSQL
- [ ] Integração completa dos ETLs
- [ ] Execução real dos pipelines

### Beta

- [ ] Módulo de Resultados
- [ ] Histórico de Execuções
- [ ] Exportação CSV
- [ ] Exportação Excel
- [ ] Controle de Usuários
- [ ] Auditoria de Processamento

### Produção

- [ ] Agendamento automático de execuções
- [ ] Notificações
- [ ] API pública
- [ ] Multiempresa
- [ ] Observabilidade
- [ ] Monitoramento operacional

---

## Instalação

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

# Linux
source venv/bin/activate

pip install -r requirements.txt

python app.py
```

---

## Objetivo

Transformar dados públicos brasileiros em inteligência de mercado acessível, estruturada e acionável para apoiar decisões estratégicas.

---

## Licença

Projeto privado.

Todos os direitos reservados.
