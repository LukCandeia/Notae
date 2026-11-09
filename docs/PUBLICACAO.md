# Publicação do Notaê

Este guia descreve como publicar e manter o projeto no GitHub. O repositório do Notaê é [LukCandeia/Notae](https://github.com/LukCandeia/Notae). Os ZIPs gerados ficam em `dist` e devem ser disponibilizados como anexos de uma release, fora da árvore de código.

## Antes de publicar

- Revisar nome Notaê, usuário de autoria e licença MIT.
- Conferir o README e executar `npm test`, `npm run check` e `npm run package`.
- Fazer o teste manual em uma cópia vazia do modelo, conforme `VERIFICACAO.md`.
- Conferir a lista dos arquivos que entrarão no primeiro commit. Não adicionar o vault pessoal nem seu histórico Git.
- Usar um repositório novo, sem histórico contendo dados particulares.

## Criar o repositório

No GitHub, crie um repositório público chamado **notae**, com a descrição sugerida:

> Organização de estudos em português brasileiro para Obsidian. Crie disciplinas, estudos independentes e guarde notas e materiais sem complicação.

Envie a raiz deste projeto, incluindo a pasta oculta `.obsidian` dentro de `vault`. GitHub Desktop ou Git podem incluir esses arquivos; um upload manual deve ser conferido para não omitir a pasta oculta. O `.gitignore` não deve esconder o plugin, os estilos nem as configurações públicas.

Em **Settings → General**, marque **Template repository**. Quem preferir manter uma cópia no GitHub poderá usar **Use this template**. Quem só quiser estudar poderá baixar o ZIP.

## Primeira versão

Depois da revisão, crie uma release **v0.1.0**, anexando apenas `dist/notae-v0.1.0.zip` e o arquivo de checksum gerado. O número da release do modelo é independente do número do plugin incluído, indicado no manifesto.

Descrição sugerida:

> Primeira versão do Notaê: um vault modelo em português brasileiro com criação automática de disciplinas e estudos independentes, formulário para textos e arquivos, caixa de entrada e listas de conteúdo. Não inclui sincronização nem lembretes. Consulte a matriz de verificação para saber quais plataformas foram testadas.

Não anunciar suporte Android como testado antes de executar os passos de verificação no aparelho. A submissão ao catálogo de plugins do Obsidian será uma etapa posterior, com revisão própria.

## Referências

- [Criar um repositório modelo](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository).
- [Licença MIT](https://choosealicense.com/licenses/mit/).
- [Publicar um plugin do Obsidian](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin).
