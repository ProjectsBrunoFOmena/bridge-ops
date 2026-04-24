# Portal de Exceções da Integração Pedidos ↔ ERP Mock

MVP de backoffice para operação de falhas de integração entre pedidos do e-commerce e ERP simulado, com triagem, correção, reprocessamento e auditoria.

## Objetivo

Permitir que o time operacional:

- liste exceções de integração com filtros;
- inspecione payload e histórico de tentativas;
- aplique ação corretiva;
- reprocese integração com segurança;
- mantenha trilha auditável de todas as ações.

## Escopo funcional

1. Cadastro simplificado de cliente e criação de pedido.
2. Integração com ERP mock que pode retornar sucesso/falha controlada.
3. Portal de exceções com status:
   - `aberta`
   - `em_analise`
   - `resolvida`
   - `descartada`
4. Ações de `operator`:
   - marcar em análise;
   - corrigir SKU (quando aplicável);
   - reprocessar integração;
   - descartar com motivo obrigatório.

## Arquitetura (visão textual)

Serviços esperados no `docker compose`:

- `db` (PostgreSQL)
- `api` (backend principal)
- `worker` (processamento assíncrono)
- `erp-mock` (simulador de integração)
- `web` (frontend React)

Contextos delimitados:

- `orders`: cliente, pedido, confirmação e estado agregado.
- `integration`: tentativas, exceções, retry, reprocesso e auditoria.

## Modelagem mínima

Entidades obrigatórias:

- `customers`
- `orders`
- `order_items`
- `integration_attempts`
- `exceptions`
- `audit_logs`
- `outbox_events` (quando usar outbox)

Estados de pedido:

- `rascunho`
- `confirmado`
- `em_integracao`
- `integrado`
- `com_excecao`

## Segurança e papéis

- Autenticação via JWT.
- Papéis:
  - `viewer`: somente consulta.
  - `operator`: consulta + ações operacionais.

## Tratamento de erros e rastreabilidade

- Padronização de erro (preferência: `application/problem+json`).
- Uso de `correlation_id` em API, worker, ERP mock, tentativas e auditoria.
- Falhas temporárias (`503`) devem ser diferenciadas de falhas de negócio.

## Concorrência

Se dois operadores atuarem no mesmo item:

- apenas um pode assumir a análise;
- a segunda ação concorrente deve retornar `409`;
- reprocesso/descarte exige validação de lock.

## Como rodar localmente

1. Criar arquivo `.env` a partir de `.env.example`.
2. Subir ambiente:

```bash
docker compose up --build
```

3. Aguardar serviços:
   - API
   - ERP mock
   - Worker
   - Frontend
   - PostgreSQL

## Simulação de falhas

Exemplos esperados de erro no ERP mock:

- `SKU_DESCONHECIDO`
- `CLIENTE_BLOQUEADO`
- `TIMEOUT_SIMULADO`

Também deve existir modo de indisponibilidade temporária (`503` por N segundos) para validar retry.

## Credenciais de demo

Definidas no seed inicial (`infra/db/seeds/001_demo_users.sql`):

- `viewer@demo.local` / `viewer123`
- `operator@demo.local` / `operator123`

## Estrutura inicial implementada

```
.
├─ infra/
│  └─ db/
│     ├─ migrations/001_init.sql
│     └─ seeds/001_demo_users.sql
├─ services/
│  ├─ api/       # contexto orders + endpoints integration iniciais
│  ├─ worker/    # processamento assíncrono outbox + retries
│  ├─ erp-mock/  # simulador com falhas configuráveis
│  └─ web/       # frontend React (fundação)
├─ docker-compose.yml
└─ .env.example
```

## Fluxo de demonstração (5 minutos)

1. Login com usuário `operator`.
2. Criar pedido com condição de erro forçada (ex.: SKU inválido).
3. Confirmar pedido e aguardar geração de exceção.
4. Abrir detalhe da exceção e validar histórico/payload.
5. Corrigir dado permitido e reprocessar.
6. Confirmar pedido final em `integrado` com auditoria completa.

## Testes mínimos exigidos

- Testes de serviço/backend para regra de negócio.
- 1 teste de fluxo crítico integrado (API + DB de teste ou e2e leve).
- Cobertura mínima:
  - criação/confirmacao de pedido;
  - criação de exceção;
  - reprocesso com sucesso após correção.

## Critérios de aceite

- Demo ponta a ponta gera, trata e resolve exceção com rastreabilidade.
- Nenhuma ação destrutiva ocorre sem confirmação na UI.
- Execução local reproduzível via `docker compose up --build`.

## Decisões e débitos técnicos

Registrar no projeto:

- decisões arquiteturais do MVP;
- limitações conhecidas;
- prioridades para próxima sprint.
