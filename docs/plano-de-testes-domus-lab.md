# Plano de testes — Domus Lab

## Ambiente

- condomínio: Domus Lab;
- código de cadastro: `DOMUSLAB`;
- estrutura: Bloco Teste;
- andares: 3;
- unidades: 101–104, 201–204 e 301–304;
- finalidade: validação ponta a ponta sem afetar o I9 Horto.

O ambiente não deve receber moradores ou encomendas reais.

## Contas necessárias

Usar endereços de e-mail controlados pela equipe de teste:

1. administrador principal;
2. síndico;
3. subsíndico;
4. zelador;
5. porteiro;
6. morador da unidade 101.

As contas devem ser individuais. Não reutilizar uma conta que esteja vinculada
a outro condomínio enquanto a seleção de múltiplos condomínios não estiver
implementada.

## Matriz de permissões

| Ação | Administrador | Síndico | Subsíndico | Zelador | Porteiro | Morador |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Registrar encomenda | sim | sim | sim | sim | sim | não |
| Consultar encomendas do condomínio | sim | sim | sim | sim | sim | não |
| Gerenciar blocos e unidades | sim | sim | sim | não | não | não |
| Convidar e desativar equipe | sim | sim | sim | não | não | não |
| Aprovar/desativar moradores | sim | sim | sim | não | não | não |
| Ver encomendas da própria unidade | não | não | não | não | não | sim |
| Confirmar retirada da própria unidade | não | não | não | não | não | sim |

Administradores da plataforma não podem ocupar qualquer perfil do condomínio.

## Cenário principal

1. administrador convida os demais perfis;
2. morador é vinculado à unidade 101;
3. porteiro registra uma encomenda para a unidade 101;
4. morador visualiza a pendência;
5. morador confirma a retirada;
6. portaria consulta a retirada no histórico;
7. métricas são atualizadas;
8. uma segunda confirmação da mesma encomenda é rejeitada.

## Cenários de autorização

- zelador tenta convidar uma pessoa: deve ser rejeitado;
- porteiro tenta aprovar ou desativar morador via API: deve ser rejeitado;
- síndico aprova, desativa e reativa morador: deve funcionar;
- subsíndico gerencia uma unidade: deve funcionar;
- morador tenta acessar encomenda de outra unidade: não deve receber dados;
- usuário do Domus Lab tenta acessar dados do I9: não deve receber dados;
- administrador da plataforma tenta ser convidado: deve ser rejeitado.

## Limites

- segundo síndico ativo ou convidado: rejeitar;
- segundo subsíndico ativo ou convidado: rejeitar;
- segundo zelador ativo ou convidado: rejeitar;
- porteiros 1 a 10: permitir;
- décimo primeiro porteiro: rejeitar;

## Critério para iniciar o piloto no I9

- todos os cenários principais aprovados;
- nenhuma violação de isolamento ou elevação de privilégio;
- cancelamento/correção e retirada pela portaria implementados;
- procedimento de suporte e recuperação documentado;
- contas de teste removidas ou mantidas apenas no Domus Lab.
