# Domus One

Sistema digital de recebimento e retirada de encomendas para condomínios.

**Aplicação:** <https://sabion.io/domus-one/><br>
**Repositório:** <https://github.com/sergiogbernardo/domus-one>

> **Marca:** Domus One<br>
> **Assinatura:** Gestão inteligente para condomínios.<br>
> **Primeiro módulo:** Domus One Encomendas.

O nome combina `domus` — casa em latim — com `one`, representando uma única
plataforma para centralizar a operação e a comunicação do condomínio.

## Problema

Hoje a portaria registra encomendas em um livro físico e coleta uma assinatura
na retirada. Isso dificulta avisos, buscas, auditoria e acompanhamento de itens
que continuam aguardando o morador.

## Solução proposta

O porteiro registra a encomenda e seleciona o apartamento. Os moradores
vinculados à unidade veem o novo item no celular. Na retirada, um morador
autenticado confirma o recebimento, e o sistema preserva data, hora e usuário
responsável no histórico.

## Fluxo principal do MVP

1. O porteiro entra no painel da portaria.
2. Registra apartamento, destinatário, transportadora e uma observação opcional.
3. O sistema marca a encomenda como `aguardando_retirada`.
4. Todos os moradores ativos daquele apartamento veem o novo item.
5. Na portaria, o morador abre o item e toca em **Confirmar retirada**.
6. O sistema registra quem retirou e quando, e muda o status para `retirada`.
7. Porteiros e moradores consultam o histórico permitido para seu perfil.

## Stack escolhida

- React 19 + TypeScript + Vite;
- Supabase Auth, PostgreSQL, Realtime e Row Level Security (RLS);
- PWA responsiva para instalação no computador e no Android;
- GitHub Pages para o frontend estático;
- GitHub Actions para build e publicação.

Essa base segue o padrão já usado no projeto `colafig` deste workspace. A PWA
atende a primeira versão; no futuro, o mesmo frontend poderá ser empacotado com
Tauri no Linux e Capacitor no Android, se houver necessidade de recursos
nativos.

## Perfis

| Perfil | Responsabilidades |
| --- | --- |
| Administrador | Configurar condomínio, blocos, apartamentos, porteiros e moradores |
| Porteiro | Registrar, localizar e acompanhar encomendas da portaria |
| Morador | Ver encomendas da própria unidade e confirmar retirada |

## Limites do primeiro MVP

Incluído:

- autenticação e recuperação de acesso;
- cadastro de condomínio, blocos e unidades;
- convite/vínculo de usuários;
- registro e consulta de encomendas;
- atualização em tempo real;
- confirmação digital de retirada;
- histórico e trilha básica de auditoria;
- interface responsiva e instalável.

Fica para depois:

- foto da encomenda e leitura de etiqueta/código de barras;
- push notification, WhatsApp ou e-mail transacional;
- assinatura desenhada na tela;
- controle de correspondências, visitantes e chaves;
- aplicativo nativo publicado nas lojas;
- métricas avançadas e suporte a várias portarias por condomínio.

## Princípios de segurança

- nenhuma chave secreta ou `service_role` será enviada ao navegador;
- todas as tabelas expostas terão RLS habilitada;
- o morador só poderá consultar encomendas das unidades às quais está vinculado;
- o porteiro só poderá operar dentro do próprio condomínio;
- retirada será uma transição controlada, não uma edição livre do registro;
- eventos importantes formarão uma trilha de auditoria;
- dados pessoais serão minimizados desde o MVP.

## Identidade visual

O produto terá uma identidade própria, sem copiar o visual dos demais projetos
do workspace. A direção escolhida é executiva, contemporânea e discreta:

- azul-marinho profundo e tons de pedra como base;
- verde mineral usado somente para sucesso e confirmação;
- tipografia limpa, com números e horários muito legíveis;
- superfícies claras, bordas finas e sombras quase imperceptíveis;
- poucos ícones e nenhuma decoração sem função;
- painel desktop eficiente para a portaria e experiência móvel refinada para o
  morador.

A especificação completa está em [Direção visual](docs/direcao-visual.md).

## Documentação

- [Plano de produto](docs/plano-de-produto.md)
- [Arquitetura e modelo de dados](docs/arquitetura-e-dados.md)
- [Direção visual](docs/direcao-visual.md)
- [Decisões em aberto](docs/decisoes-em-aberto.md)

## Desenvolvimento

Requer Node.js 22.13 ou posterior.

```bash
npm install
npm run dev
```

A primeira versão navegável contém dados demonstrativos e permite:

- pesquisar e filtrar encomendas no painel da portaria;
- registrar uma nova encomenda durante a sessão;
- alternar para a experiência móvel do apartamento 1204;
- confirmar uma retirada e visualizar o histórico atualizado;
- testar a adaptação da interface para desktop e celular.

Os dados demonstrativos ainda não são persistidos. O cliente Supabase e as
variáveis públicas já estão preparados, mas autenticação, banco e RLS serão
implementados na próxima fatia vertical.

Para gerar a versão publicada:

```bash
npm run build
```

O workflow em `.github/workflows/deploy.yml` publica a pasta `dist` no GitHub
Pages a cada atualização da branch `main`.

O domínio `sabion.io` é configurado no repositório principal do GitHub Pages.
Este projeto não deve ter um arquivo `CNAME` próprio: ele é servido como Project
Page no caminho `/domus-one/`.

No Supabase Auth, as URLs permitidas deverão incluir:

```text
https://sabion.io/domus-one/
http://localhost:5173/domus-one/
```

## Próximo passo

Revisar a experiência demonstrativa com um porteiro e pelo menos um morador.
Depois, criar o projeto Supabase de desenvolvimento e substituir os dados de
demonstração por autenticação, registros persistentes e políticas RLS.
