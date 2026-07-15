# Bootstrap do Supabase

## Migração inicial

A migração `20260715023000_initial_multi_tenant_schema.sql` cria a fundação
multi-condomínio, habilita RLS em todas as tabelas públicas e restringe
operações sensíveis a funções controladas.

## Primeiro administrador da plataforma

O primeiro usuário deve ser criado normalmente pelo Supabase Auth. Depois de
confirmar o e-mail, seu UUID poderá ser promovido uma única vez no SQL Editor:

```sql
insert into public.platform_admins (user_id)
values ('UUID_DO_USUARIO');
```

Não inclua esse UUID na migração compartilhada. O vínculo é específico de cada
ambiente.

## Modelo de acesso

- `platform_admins`: operadores da plataforma Domus One;
- `staff_memberships`: administradores e porteiros de um condomínio;
- `unit_memberships`: vínculos históricos de moradores com unidades;
- moradores pendentes não acessam encomendas;
- moradores inativos perdem o acesso imediatamente, mas o histórico permanece;
- o administrador proprietário não consome vaga; convites e demais usuários
  operacionais compartilham o limite de 10 vagas por condomínio;
- alterações críticas e retiradas geram eventos de auditoria.

## Convites e ativação

- não existe cadastro público capaz de escolher um perfil;
- condomínios são criados exclusivamente por `platform_admins`;
- a criação do condomínio gera o convite do administrador principal;
- administradores do condomínio podem convidar somente usuários operacionais;
- o e-mail confirmado no Supabase Auth reivindica o convite correspondente;
- uma conta autenticada sem vínculo permanece na tela de acesso pendente;
- o banco, e não o formulário do navegador, determina o perfil efetivo.

O administrador principal não ocupa uma das 10 vagas operacionais. Convites de
porteiros já contam no limite para impedir que vários convites pendentes
ultrapassem a capacidade contratada.

## Checklist após aplicar

1. confirmar que todas as tabelas públicas mostram RLS habilitada;
2. cadastrar um usuário de teste e verificar a criação automática do perfil;
3. promover somente o primeiro operador em `platform_admins`;
4. testar usuário anônimo, morador pendente, morador ativo, porteiro,
   administrador e operador da plataforma;
5. confirmar que usuários de condomínios diferentes nunca compartilham dados;
6. testar o limite de 10 usuários operacionais;
7. revisar os Advisors do Supabase antes de usar dados reais.
