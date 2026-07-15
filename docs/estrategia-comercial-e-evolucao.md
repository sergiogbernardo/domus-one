# Estratégia comercial e evolução

> Registro de planejamento criado em julho de 2026. Preços de fornecedores e
> hipóteses comerciais devem ser revisados antes do lançamento.

## Distribuição do aplicativo

### Etapa 1 — PWA

Manter a aplicação web como base e completar a experiência instalável:

- instalação pelo navegador no computador da portaria;
- ícone e janela próprios;
- atualização automática;
- modo tela cheia;
- cache seguro da interface, mantendo operações críticas dependentes de
  conexão com o Supabase.

Esta é a prioridade por entregar experiência semelhante à de um aplicativo
com menor custo de distribuição e suporte.

### Etapa 2 — Linux e Android

Empacotar o frontend com Tauri quando o piloto comprovar necessidade de
integrações nativas. Formatos Linux previstos: AppImage, `.deb` e `.rpm`.
Depois, gerar a versão Android a partir da mesma base.

Possíveis integrações futuras:

- inicialização automática no computador da portaria;
- atualização controlada;
- leitor de código de barras;
- impressora;
- notificações nativas;
- publicação na Google Play.

Referência: <https://v2.tauri.app/distribute/>.

## Hipótese de valor

- Faixa estimada de reposição como software personalizado: R$ 30 mil a
  R$ 70 mil.
- O valor do produto como SaaS dependerá de receita recorrente, retenção,
  margem, quantidade de condomínios e comprovação de uso diário.
- O principal marco de valorização será um condomínio operando encomendas
  reais e pagando pela solução.

Essas faixas são hipóteses de planejamento, não uma avaliação formal.

## Modelo comercial inicial

Cobrança recomendada por condomínio e faixa de unidades:

| Plano | Quantidade de unidades | Mensalidade sugerida |
| --- | ---: | ---: |
| Essencial | até 150 | R$ 149 |
| Profissional | 151 a 350 | R$ 249 |
| Executivo | 351 a 700 | R$ 399 |
| Rede | administradoras e vários condomínios | sob consulta |

Serviços adicionais previstos:

- implantação e configuração: R$ 600 a R$ 1.500;
- WhatsApp: adicional sugerido de R$ 99/mês, sujeito a franquia e consumo;
- personalização de marca e domínio;
- treinamento presencial;
- importação ou saneamento de cadastros.

Para o I9 Horto, com 256 unidades, a hipótese inicial é o plano Profissional
por R$ 249/mês.

### Piloto comercial

- duração de 30 a 60 dias;
- mensalidade gratuita ou reduzida;
- implantação gratuita ou reduzida;
- operação inicialmente paralela ao livro físico;
- autorização para utilizar resultados anonimizados como estudo de caso;
- decisão de continuidade baseada em métricas e retorno da portaria.

## Infraestrutura Supabase

Limites observados no plano Free em julho de 2026:

- 500 MB de banco por projeto;
- 50 mil usuários ativos mensais;
- 5 GB de egress;
- 1 GB de armazenamento de arquivos;
- 500 mil execuções de Edge Functions;
- 2 milhões de mensagens Realtime;
- 200 conexões Realtime simultâneas;
- possibilidade de pausa após período de baixa atividade.

Uso recomendado:

- Free apenas para desenvolvimento e piloto inicial;
- migrar para Pro com o primeiro ou segundo cliente pagante;
- manter um único projeto multi-condomínio, com isolamento por RLS;
- acompanhar banco, egress, invocações e conexões no painel;
- não oferecer SLA comercial apoiado no plano Free.

O plano Pro iniciava em US$ 25/mês na data deste documento, com 8 GB de banco,
250 GB de egress, 100 mil usuários ativos mensais e backups diários. Conferir
os valores vigentes antes da contratação:

- <https://supabase.com/pricing>
- <https://supabase.com/docs/guides/platform/billing-on-supabase>
- <https://supabase.com/docs/guides/platform/free-project-pausing>

## Estratégia de notificações

Ordem recomendada:

1. notificação dentro do Domus One;
2. Web Push pela PWA;
3. e-mail como alternativa;
4. WhatsApp como adicional premium;
5. push nativo no Android.

### WhatsApp oficial

Utilizar exclusivamente a WhatsApp Business Platform/Cloud API. Não utilizar
automação de WhatsApp Web.

Fluxo previsto:

1. o porteiro registra a encomenda;
2. o banco cria um item em uma fila de notificações;
3. uma Edge Function processa a fila;
4. a Cloud API envia um template de utilidade aprovado;
5. webhooks registram envio, entrega, leitura ou falha;
6. o morador abre o Domus One por um link seguro.

Requisitos de produto e privacidade:

- telefone validado do morador;
- consentimento explícito e versionado;
- preferência individual por canal;
- opção simples de cancelamento;
- template aprovado pela Meta;
- evitar dados sensíveis ou descrição detalhada do pacote na mensagem;
- trilha de entrega e falha;
- custo por mensagem separado na apuração financeira.

O preço da Meta varia por país, categoria e volume. A franquia e o excedente
do Domus One somente devem ser definidos após consultar a tabela vigente.

Referência oficial da Cloud API:
<https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api>.

## Sequência futura aprovada

1. concluir os testes de ponta a ponta no I9;
2. executar piloto controlado;
3. completar a PWA instalável;
4. adicionar Web Push;
5. criar cadastro de telefone, consentimento e preferências;
6. integrar WhatsApp oficial como módulo premium;
7. empacotar Linux e Android com Tauri;
8. validar e ajustar as faixas comerciais com dados reais.
