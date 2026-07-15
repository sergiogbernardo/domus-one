# Arquitetura e modelo de dados

## Visão geral

```text
Computador da portaria ─┐
                       ├─ PWA React no GitHub Pages ─ Supabase Auth
Celular do morador ─────┘                           ├ PostgreSQL + RLS
                                                   └ Realtime
```

O GitHub Pages hospeda somente arquivos estáticos. Autenticação, regras de
acesso, persistência e eventos em tempo real ficam no Supabase. Operações que
precisarem de segredos ou integrações externas deverão usar Edge Functions, e
nunca código executado no navegador.

## Entidades propostas

| Entidade | Finalidade | Campos centrais |
| --- | --- | --- |
| `condominiums` | Isolamento principal do cliente | `id`, `name`, `status` |
| `buildings` | Blocos ou torres | `id`, `condominium_id`, `name` |
| `units` | Apartamentos/unidades | `id`, `building_id`, `number` |
| `profiles` | Dados mínimos do usuário autenticado | `id`, `display_name` |
| `memberships` | Papel do usuário no condomínio | `user_id`, `condominium_id`, `role`, `status` |
| `unit_members` | Vínculo entre morador e unidade | `user_id`, `unit_id`, `status` |
| `packages` | Registro atual da encomenda | `id`, `unit_id`, `recipient_name`, `carrier`, `status`, `created_by`, `created_at` |
| `package_events` | Histórico imutável do ciclo de vida | `package_id`, `type`, `actor_id`, `occurred_at`, `metadata` |
| `invites` | Convite com expiração e uso único | `condominium_id`, `unit_id`, `role`, `expires_at` |

## Estados da encomenda

```text
aguardando_retirada ── confirmar retirada ──> retirada
          │
          └── correção administrativa ──────> cancelada
```

Uma retirada não deve ser feita com um `update` irrestrito do frontend. A
operação deve validar o usuário, o vínculo com a unidade, o status atual e
registrar o evento na mesma transação de banco.

## Diretrizes de RLS

- administrador: gerencia somente registros do próprio condomínio;
- porteiro: lê unidades e opera encomendas somente do próprio condomínio;
- morador: lê encomendas somente das unidades com vínculo ativo;
- eventos seguem a visibilidade da encomenda pai;
- inserts e transições usam políticas explícitas ou funções SQL com escopo
  mínimo;
- convites não expõem tokens em consultas públicas.

## Preparação para Linux e Android

A interface deverá ser responsiva e separar domínio, acesso a dados e UI. A
primeira versão será uma PWA. Se o piloto mostrar necessidade de integração
nativa, notificações mais confiáveis ou distribuição em lojas, serão avaliados:

- Tauri para pacote desktop Linux;
- Capacitor para pacote Android;
- uma camada compartilhada de TypeScript para regras e contratos.

Essa evolução não deve ser antecipada antes de validar o uso da PWA.
