# Direção visual

## Conceito

**Portaria executiva, sem frieza.**

O sistema deve transmitir controle, confiança e organização. A interface não
será infantil, excessivamente colorida ou parecida com um painel técnico. A
personalidade vem da precisão dos detalhes, da hierarquia tipográfica e do uso
contido da cor.

## Direção de marca

### Domus One

**Domus One** une a ideia de casa a uma plataforma central. A marca deve ser
apresentada com sobriedade e confiança, sem parecer uma construtora ou um
sistema de segurança patrimonial.

Arquitetura recomendada:

- **Domus One** — marca principal;
- **Domus One Encomendas** — primeiro módulo;
- **Gestão inteligente para condomínios.** — assinatura institucional;
- **Chegou na portaria. Você já sabe.** — mensagem do módulo de encomendas.

O nome técnico do projeto e do futuro repositório é `domus-one`.

### Símbolo

A exploração inicial deve combinar, de forma abstrata e simples:

- a letra `D` de Domus;
- o número `1` ou uma única linha vertical;
- uma entrada ou portal arquitetônico;
- geometria suficientemente simples para funcionar como ícone de aplicativo.

Evitar desenhos literais de casa, telhado, caixa de papelão, escudo ou câmera.
Esses símbolos são comuns no setor e reduziriam a personalidade executiva da
marca.

## Paleta inicial

| Papel | Cor | Uso |
| --- | --- | --- |
| Navy 950 | `#0B1623` | cabeçalhos, navegação e marca |
| Navy 800 | `#172A3A` | superfícies escuras e hover |
| Stone 50 | `#F7F7F4` | fundo principal |
| Branco | `#FFFFFF` | cartões e formulários |
| Stone 300 | `#D8D8D1` | bordas e divisores |
| Graphite | `#26313A` | texto principal |
| Slate | `#68747D` | texto secundário |
| Mineral | `#187A68` | confirmação e ações positivas |
| Amber | `#B7791F` | encomenda aguardando atenção |
| Oxblood | `#9B3434` | erro ou ação destrutiva |

Não usar gradientes fortes, roxo neon, excesso de azul elétrico ou grandes
áreas verdes. Status devem combinar cor, texto e ícone para não depender apenas
da percepção de cor.

## Tipografia

- interface: **Inter** ou uma alternativa variável de alta legibilidade;
- números de apartamento, contagens e horários: numerais tabulares;
- títulos: peso 600, com pouco contraste de tamanho;
- texto operacional: mínimo de 16 px nas ações críticas;
- caixa alta apenas em pequenos rótulos, nunca em parágrafos ou botões longos.

Para evitar dependência externa e melhorar privacidade, a fonte poderá ser
armazenada no próprio projeto ou substituída inicialmente pela pilha nativa do
sistema.

## Componentes característicos

### Navegação

- desktop: barra lateral estreita em navy, com marca, contexto do condomínio e
  poucas seções;
- celular: cabeçalho compacto e navegação inferior com no máximo quatro itens;
- ação **Nova encomenda** sempre visível para o porteiro.

### Cartão de encomenda

- apartamento como informação dominante;
- destinatário e transportadora em segundo plano;
- horário e tempo de espera com numerais tabulares;
- status em etiqueta discreta;
- nenhuma foto obrigatória no MVP.

### Confirmação de retirada

- tela limpa, mostrando apartamento, destinatário e registro de chegada;
- botão principal mineral e de largura confortável;
- etapa final com texto explícito: “Confirmar retirada agora”;
- retorno visual imediato com responsável, data e horário.

### Painel da portaria

- contagem de encomendas aguardando retirada;
- busca prioritária por apartamento ou destinatário;
- lista ou tabela adaptável, sem gráficos decorativos;
- ações frequentes acessíveis por teclado;
- modo de alta densidade opcional somente depois do piloto.

## Duas experiências, uma identidade

### Portaria — desktop

A experiência deve favorecer velocidade, busca e leitura à distância. O painel
pode ser mais denso, mas nunca apertado. Campos seguem a ordem real de trabalho
e o registro deve ser possível sem navegar por várias telas.

### Morador — celular

A experiência deve ser mais simples e editorial: encomenda pendente em
destaque, histórico abaixo e confirmação sem ambiguidade. O morador não precisa
ver controles administrativos.

## Movimento e feedback

- transições entre 120 e 200 ms;
- animação somente para indicar mudança de estado ou continuidade;
- confirmação pode usar um check desenhado de forma breve e discreta;
- respeitar `prefers-reduced-motion`;
- carregamentos usam skeleton apenas quando realmente evitam salto de layout.

## Acessibilidade

- contraste conforme WCAG AA;
- foco de teclado claramente visível;
- alvos de toque com pelo menos 44 × 44 px;
- mensagens de erro próximas ao campo e com instrução de correção;
- estados nunca comunicados somente por cor;
- fluxo completo da portaria operável por teclado.

## O que evitar

- aparência de template administrativo genérico;
- dashboard cheio de gráficos sem utilidade operacional;
- cartões excessivamente arredondados e sombras pesadas;
- emojis como ícones do produto;
- linguagem informal demais em confirmações críticas;
- menus diferentes para tarefas equivalentes no desktop e no celular;
- modais em sequência para concluir uma única operação.

## Primeiras telas a desenhar

1. login;
2. painel da portaria com pendências;
3. formulário rápido de nova encomenda;
4. tela inicial do morador;
5. detalhe e confirmação da retirada;
6. histórico e detalhe do evento;
7. gestão básica de unidades e usuários.

Essas telas formarão o protótipo visual antes de expandir o sistema.
