# Plano de produto

## Objetivo

Substituir o livro físico da portaria por um registro digital simples,
rastreável e acessível ao morador, reduzindo o tempo de atendimento e a dúvida
sobre encomendas pendentes.

## Indicadores iniciais

- tempo médio para registrar uma encomenda;
- quantidade de encomendas aguardando retirada;
- tempo entre chegada e retirada;
- percentual de retiradas confirmadas pelo próprio morador;
- registros que precisaram de correção ou intervenção administrativa.

## Regras de negócio iniciais

1. Uma encomenda pertence a um condomínio e a uma unidade.
2. Uma unidade pode ter vários moradores ativos.
3. Uma pessoa pode estar vinculada a mais de uma unidade.
4. Todo morador ativo da unidade pode ver as encomendas pendentes dela.
5. Apenas porteiros ativos do condomínio podem registrar encomendas.
6. Apenas moradores elegíveis ou um porteiro autorizado podem confirmar uma
   retirada.
7. A confirmação registra ator, data e hora; o registro original não é apagado.
8. Correções administrativas geram evento de auditoria com justificativa.
9. Exclusão física de encomendas não faz parte da operação cotidiana.

## Histórias essenciais

### Porteiro

- Como porteiro, quero localizar rapidamente um apartamento e registrar uma
  encomenda em poucos campos.
- Como porteiro, quero ver as encomendas ainda não retiradas para encontrar um
  pacote rapidamente.
- Como porteiro, quero consultar quem confirmou uma retirada e em qual horário.

### Morador

- Como morador, quero ver imediatamente que há uma nova encomenda para minha
  unidade.
- Como morador, quero confirmar a retirada pelo celular sem assinar um livro.
- Como morador, quero consultar meu histórico recente.

### Administrador

- Como administrador, quero gerenciar apartamentos e vínculos de usuários.
- Como administrador, quero corrigir um registro com justificativa e trilha de
  auditoria.

## Plano de execução

### Fase 0 — validação operacional

- acompanhar o registro e a retirada reais na portaria;
- medir quais campos são realmente necessários;
- decidir como moradores e porteiros recebem o primeiro acesso;
- validar o procedimento de exceção quando o morador está sem celular;
- confirmar a política de retenção de dados do condomínio.

Critério de saída: fluxo e decisões críticas aprovados por portaria e gestão.

### Fase 1 — fundação técnica

- criar app React/TypeScript/Vite;
- configurar PWA e base compatível com GitHub Pages;
- criar Supabase de desenvolvimento;
- modelar banco, migrações e políticas RLS;
- configurar autenticação e ambientes;
- adicionar testes básicos de autorização.

Critério de saída: usuário autenticado acessa somente o condomínio e as
unidades permitidas.

### Fase 2 — fatia vertical do MVP

- painel da portaria;
- cadastro de encomenda;
- lista de pendências do apartamento;
- atualização em tempo real;
- confirmação de retirada;
- histórico de eventos.

Critério de saída: uma encomenda percorre o fluxo completo em ambiente de teste.

### Fase 3 — administração e qualidade

- gestão de condomínios, blocos, unidades e vínculos;
- busca, filtros e tratamento de duplicidade;
- estados vazios, erros e acessibilidade;
- testes de integração e E2E dos fluxos críticos;
- revisão LGPD e segurança.

Critério de saída: piloto utilizável sem alterações manuais no banco.

### Fase 4 — piloto controlado

- cadastrar uma portaria e um grupo pequeno de moradores;
- operar em paralelo com o livro por período definido;
- observar falhas e medir indicadores;
- documentar suporte, backup e recuperação;
- decidir a migração definitiva.

Critério de saída: gestão autoriza substituir o livro no escopo do piloto.

### Fase 5 — evolução

- completar a PWA instalável e adicionar Web Push;
- cadastrar telefone, consentimento e preferências de notificação;
- oferecer WhatsApp oficial como módulo premium;
- leitura de códigos e fotos, se justificadas;
- empacotamento Linux e Android com Tauri;
- relatórios e suporte a operações maiores.

As hipóteses comerciais, limites de infraestrutura e sequência de distribuição
estão registradas em [Estratégia comercial e evolução](estrategia-comercial-e-evolucao.md).

## Ordem recomendada para desenvolvimento

A primeira entrega deve atravessar todo o sistema em pequena escala: banco,
RLS, tela da portaria, tela do morador e confirmação. Isso revela cedo os
riscos de autorização e do fluxo real antes de investir em recursos
secundários.
