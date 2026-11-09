# Contribuir com o Notaê

O objetivo é manter a organização dos estudos simples. São bem-vindas melhorias de acessibilidade, correções, documentação e relatos de uso em diferentes plataformas.

## Antes de propor uma mudança

Abra uma issue descrevendo o problema, a plataforma, a versão do Obsidian e os passos para reproduzir. Use exemplos fictícios. Não inclua notas pessoais, documentos de terceiros ou dados de acesso em capturas e anexos.

Para mudanças maiores de comportamento, explique a necessidade antes de implementar. Evite adicionar serviços externos ou novos plugins como requisito sem discutir o impacto na instalação.

## Trabalhar no código

1. Crie uma branch para sua mudança.
2. Edite o código em `vault/.obsidian/plugins/notae/` e os modelos relevantes.
3. Rode `npm test` e `npm run check`.
4. Para testar no Obsidian, use uma cópia do vault com conteúdo fictício.
5. No pull request, explique o problema, o comportamento final e como verificou a mudança.

Não envie arquivos de workspace, credenciais, histórico de conversas ou notas do seu próprio semestre. Preserve os avisos de licença. Contribuições aceitas integram o projeto sob a mesma licença MIT.
