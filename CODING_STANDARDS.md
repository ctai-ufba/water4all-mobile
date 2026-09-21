# Padrões de Codificação
 
## Documentação e Comentários
 
O repositório deve manter a cobertura mínima de docstrings exigida pela
integração contínua.
 
Funções e métodos devem ser documentados quando seu propósito, contrato,
comportamento, entradas, saídas, efeitos colaterais, suposições ou modos de
falha não forem evidentes a partir de sua assinatura, tipos e contexto local.
 
APIs públicas e funções que concentram regras de domínio, integração externa,
efeitos colaterais relevantes ou tratamento de falhas devem documentar seu
propósito e o comportamento não óbvio. Parâmetros, valores de retorno e
exceções devem ser descritos quando forem relevantes para o uso correto da API.
 
Documentação de APIs deve registrar o contrato observável por seus consumidores.

### Documentação de Uso

Interfaces destinadas ao uso fora do módulo — como APIs públicas, scripts
executáveis e pipelines ou notebooks reutilizáveis — devem ter um guia de
primeiro uso quando a forma correta de chamá-las ou executá-las não for
evidente.

O guia deve ficar em um local canônico e descobrível a partir da interface,
como a docstring do módulo ou da API, o README ou um documento próximo. Uma
mesma explicação deve ter uma fonte canônica; referências podem apontar para
ela em vez de duplicá-la.

De forma concisa, o guia de primeiro uso deve cobrir:

- objetivo da interface;
- pré-requisitos e formato ou organização de entrada que não forem evidentes;
- um exemplo mínimo copiável de chamada ou execução;
- saída, artefatos ou efeitos observáveis esperados; e
- configurações, políticas ou falhas relevantes para concluir o primeiro uso
  corretamente.

Os exemplos devem ser revisados junto com mudanças da interface e permanecer
consistentes com a implementação. Automatize sua execução somente quando isso
for de baixo custo e trouxer cobertura útil.

Comentários internos devem preservar decisões, invariantes, limitações e
restrições da implementação.
 
Comentários devem ser adicionados a trechos complexos ou não óbvios quando
ajudarem o leitor a entender a intenção, o raciocínio, as suposições, o
algoritmo, uma alternativa rejeitada ou uma restrição da implementação.
 
Comentários devem explicar **por que** o código existe ou por que uma abordagem
foi escolhida, em vez de apenas repetir **o que** o código faz.
 
Prefira simplificar ou refatorar código desnecessariamente complexo a usar
comentários para compensar baixa legibilidade.
 
A lógica complexa cuja intenção não possa ser compreendida localmente deve ser:
 
- simplificada;
- extraída para uma função ou abstração com nome apropriado; ou
- documentada com uma explicação concisa do raciocínio, das invariantes ou das
  restrições envolvidas.
 
A documentação e os comentários devem permanecer consistentes com a
implementação. Comentários desatualizados, redundantes ou enganosos são
defeitos de legibilidade e devem ser corrigidos ou removidos.
