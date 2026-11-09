# Verificação da primeira versão

## Resultado em 08/11/2026

- **25 testes automatizados passaram**, incluindo primeiro uso sem disciplinas, mudança do nome do vault, comandos, notas, anexos, conflitos, recusa de uma nota particular adicionada ao modelo e ZIP com nomes em português e arquivos ocultos.
- A checagem do modelo aprovou **21 arquivos públicos**. O pacote de distribuição inclui esses arquivos, a licença e o guia de instalação.
- Nenhum arquivo do vault pessoal foi alterado nesta preparação. Somente os arquivos próprios explicitamente selecionados foram usados como base; notas, anexos pessoais, conversas e plugins de terceiros não foram copiados.
- Teste manual da edição pública no Obsidian e no Android: **pendente**.

## Verificação automatizada

Execute `npm test` e `npm run check`. Os testes usam um simulador da API do Obsidian com arquivos em memória. Nenhum teste envia dados, abre o vault pessoal ou controla a interface do sistema.

A suíte cobre criação de assuntos, validação de nomes, organização de notas e anexos, nomes duplicados, falhas de gravação, mudanças de destino, atualização das listas e independência do nome do vault. A verificação do pacote confere também arquivos permitidos, configurações, links e ausência de artefatos pessoais conhecidos.

## Verificação manual pendente nesta edição pública

Em uma cópia extraída do pacote:

1. Abrir a pasta Notaê como vault e habilitar o complemento Notaê.
2. Conferir os três botões no início e as mensagens das listas vazias.
3. Criar **Matéria de exemplo** e **Linux**. Conferir as subpastas e as páginas.
4. Adicionar anotação, prática, material com PDF e trabalho. Conferir os destinos, links de retorno e listas.
5. Guardar uma nota em **Para organizar** e escolher um destino depois.
6. Repetir um título e importar dois arquivos diferentes com o mesmo nome; conferir que nenhum conteúdo foi sobrescrito.
7. Fechar o vault, renomear sua pasta e abrir novamente. Conferir os botões e criar outro assunto.
8. Desativar o complemento e conferir que as notas continuam legíveis. Reativá-lo.
9. Repetir no Android, incluindo anexos pelo seletor de arquivos, abertura de PDFs, teclado e rolagem dos formulários.

O plugin de origem teve formulários e listas conferidos no Obsidian para Windows. Isso não substitui o teste desta cópia pública modificada. A edição pública não foi aberta pela automação na interface do usuário, a pedido do autor.

## Critério de publicação

As verificações automatizadas devem passar. Os testes manuais ainda não realizados devem ficar indicados como pendentes, sem prometer compatibilidade já verificada. Atualize esta página com plataforma, versão do Obsidian e resultado após cada teste manual.
