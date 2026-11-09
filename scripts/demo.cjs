'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { check } = require('./check.cjs');
const { VAULT_FILES } = require('./files.cjs');
const { zip } = require('./package.cjs');
const root = path.resolve(__dirname, '..');

function buildDemo() {
  check();
  // Start from the explicit public template; never read a working study vault.
  const files = new Map(VAULT_FILES.filter(file => !file.endsWith('.gitkeep')).map(file => [file, fs.readFileSync(path.join(root, 'vault', file))]));
  const put = (file, text) => {
    assert.ok(!files.has(file), 'Exemplo duplicado: ' + file);
    files.set(file, Buffer.from(text, 'utf8'));
  };
  function subject(kind, name) {
    const folder = (kind === 'disciplina' ? 'Disciplinas/' : 'Estudos independentes/') + name;
    const sections = kind === 'disciplina' ? ['Anotações', 'Materiais', 'Trabalhos e provas'] : ['Anotações', 'Práticas', 'Materiais'];
    const query = new URLSearchParams({ acao: 'conteudo', destino: folder });
    let hub = '# ' + name + '\n\n[[00 - Início|Voltar ao início]]\n\n[Adicionar conteúdo](obsidian://notae?' + query + ')\n';
    for (const section of sections) {
      hub += '\n## ' + section + '\n\n```query\npath:' + JSON.stringify(folder + '/' + section + '/') + (section === 'Materiais' ? ' -path:"/Arquivos/"' : '') + '\n```\n';
      put(folder + '/' + section + '/.gitkeep', '');
    }
    put(folder + '/Materiais/Arquivos/.gitkeep', '');
    put(folder + '/' + name + '.md', hub);
    return {
      folder,
      note(section, title, body) {
        put(folder + '/' + section + '/' + title + '.md', '# ' + title + '\n\n' + body.trim() + '\n\n[[' + folder + '/' + name + '|' + name + ']]\n');
      }
    };
  }

  const banco = subject('disciplina', 'Banco de Dados');
  banco.note('Anotações', 'Modelagem de dados', `## Ideia principal

O modelo descreve as informações que precisamos guardar e como elas se relacionam.

| Entidade | Alguns atributos |
|---|---|
| Estudante | matrícula, nome |
| Disciplina | código, título |
| Matrícula | estudante, disciplina, semestre |

## Para lembrar

Uma matrícula conecta um estudante a uma disciplina em determinado semestre.

## Minha dúvida

Quando uma relação muitos-para-muitos precisa de atributos próprios?`);
  banco.note('Materiais', 'Guia de consultas SQL', `## Minhas observações

Uma consulta de leitura começa definindo quais colunas queremos e de qual tabela elas vêm.

\`\`\`sql
SELECT nome, semestre
FROM estudantes
WHERE semestre = 2
ORDER BY nome;
\`\`\`

## Próxima prática

Montar uma consulta para listar as disciplinas de cada estudante.`);
  banco.note('Trabalhos e provas', 'Projeto de biblioteca', `**Prazo:** 12/11/2026

## Orientações

Modelar uma biblioteca fictícia com livros, leitores e empréstimos.

## Tarefas

- [x] Identificar as entidades.
- [x] Esboçar os relacionamentos.
- [ ] Definir as chaves e restrições.
- [ ] Revisar o modelo com exemplos de empréstimo.

## Observações

Separar a descrição de um livro dos exemplares disponíveis.`);

  const estatistica = subject('disciplina', 'Estatística');
  estatistica.note('Anotações', 'Média, mediana e dispersão', `## Resumo da aula

A média resume os valores usando todos os dados. A mediana indica o centro quando colocamos os valores em ordem.

## Exemplo

Para os valores **2, 4 e 9**, a média é **5** e a mediana é **4**.

## O que observar

Valores extremos podem deslocar a média. Além do centro, preciso observar a dispersão dos dados.`);
  estatistica.note('Anotações', 'Prática de análise de dados', `## Enunciado

Comparar o tempo de estudo de cinco dias fictícios: 30, 45, 45, 60 e 70 minutos.

## Minha tentativa

A soma é 250 minutos. A média é 50 minutos por dia, e a mediana é 45 minutos.

## Solução e verificação

Conferi a soma e coloquei os valores em ordem antes de escolher a mediana.

## O que aprendi

A média e a mediana podem ser diferentes mesmo em um conjunto pequeno.`);

  const metodologia = subject('disciplina', 'Metodologia Científica');
  metodologia.note('Anotações', 'Como formular uma pergunta de pesquisa', `## Ideia principal

Uma pergunta clara delimita o que queremos investigar, em qual contexto e com quais critérios.

## Exemplo fictício

Como estudantes de uma turma organizam os materiais das disciplinas ao longo do semestre?

## Próximo passo

Definir quem participa e como registrar as respostas.`);
  metodologia.note('Trabalhos e provas', 'Roteiro de revisão bibliográfica', `## Orientações

Preparar uma revisão curta sobre hábitos de estudo.

## Tarefas

- [x] Delimitar a pergunta.
- [ ] Selecionar palavras-chave.
- [ ] Registrar as fontes consultadas.
- [ ] Comparar os argumentos encontrados.

## Observações

Separar o que a fonte afirma das minhas próprias interpretações.`);

  const git = subject('estudo', 'Git e GitHub');
  git.note('Anotações', 'Commits que contam uma história', `## Ideia principal

Cada commit deve registrar uma mudança que eu consiga explicar.

## Meu fluxo de estudo

1. Conferir as alterações com \`git status\` e \`git diff\`.
2. Selecionar o que faz parte da mesma mudança.
3. Escrever uma mensagem que explique o resultado.

## Exemplo de mensagem

\`Adiciona guia de instalação do projeto\`

## Próximo assunto

[[Estudos independentes/Git e GitHub/Anotações/Branches e revisão de mudanças|Branches e revisão de mudanças]].`);
  git.note('Anotações', 'Branches e revisão de mudanças', `## Minhas observações

Uma branch permite desenvolver uma mudança antes de integrá-la à linha principal.

## Antes de abrir um pull request

- [x] Dar um nome claro à mudança.
- [ ] Revisar os arquivos alterados.
- [ ] Explicar como a mudança foi verificada.

## Minha dúvida

Como resolver um conflito quando duas branches alteram a mesma parte de um arquivo?`);
  git.note('Práticas', 'Meu primeiro repositório', `## Enunciado

Criar um repositório de exemplo para registrar um plano de estudos.

## Minha tentativa

Criei um README com o objetivo do projeto e fiz um primeiro commit.

## Solução e verificação

Usei \`git status\` para conferir a árvore de trabalho e \`git log --oneline\` para visualizar o histórico.

## O que aprendi

Uma mensagem de commit clara facilita entender o que mudou.`);
  git.note('Materiais', 'Referência rápida de comandos', `## Minhas observações

Guardei uma referência curta para consultar durante as práticas.

[[Estudos independentes/Git e GitHub/Materiais/Arquivos/comandos-git.txt|Abrir referência de comandos Git]]

## Comandos que mais uso

| Comando | O que conferir |
|---|---|
| \`git status\` | Arquivos alterados e preparados |
| \`git diff\` | Diferenças ainda não preparadas |
| \`git log --oneline\` | Histórico resumido |
| \`git branch\` | Branches locais |`);
  put(git.folder + '/Materiais/Arquivos/comandos-git.txt', 'Referência fictícia de estudo — Git\n\ngit status             Estado da árvore de trabalho\ngit diff               Alterações ainda não preparadas\ngit log --oneline      Histórico resumido\ngit branch             Branches locais\n');

  const linux = subject('estudo', 'Linux');
  linux.note('Anotações', 'Navegação pelo terminal', `## Minhas observações

Antes de executar um comando, confiro em qual diretório estou.

| Comando | Uso |
|---|---|
| \`pwd\` | Mostrar o diretório atual |
| \`ls\` | Listar o conteúdo |
| \`cd\` | Mudar de diretório |

## Exemplo

\`\`\`sh
pwd
ls
\`\`\`

## Próximo assunto

[[Estudos independentes/Linux/Práticas/Permissões de arquivos|Permissões de arquivos]].`);
  linux.note('Práticas', 'Permissões de arquivos', `## Enunciado

Interpretar as permissões \`rw-r-----\` de um arquivo fictício.

## Minha tentativa

Separei as permissões do proprietário, do grupo e dos demais usuários.

## Solução e verificação

| Quem | Permissão |
|---|---|
| Proprietário | Ler e escrever |
| Grupo | Ler |
| Demais usuários | Nenhuma |

## O que aprendi

As permissões são organizadas em três conjuntos. Ler, escrever e executar são permissões diferentes.`);
  linux.note('Materiais', 'Meu roteiro de estudo de Linux', `## Minhas observações

- [x] Navegação entre diretórios.
- [ ] Leitura de arquivos de texto.
- [ ] Permissões de arquivos.
- [ ] Processos e serviços.

## Como vou praticar

Usar uma pasta de exercícios e registrar em cada nota o comando, o resultado esperado e o que aconteceu.`);

  put('Para organizar/Ideias para o próximo estudo.md', '# Ideias para o próximo estudo\n\nComparar formas de documentar um projeto e escolher um exemplo pequeno para praticar.\n\n[[Para organizar/Caixa de entrada|Para organizar]]\n');
  const welcome = files.get('Comece aqui.md').toString('utf8');
  files.set('Comece aqui.md', Buffer.from(welcome.replace('Você começa sem disciplinas e sem temas cadastrados.', 'Esta demonstração já inclui três disciplinas e dois estudos independentes com conteúdo fictício.')));

  // Check every sample wiki-link before packaging.
  for (const [name, content] of files) if (name.endsWith('.md')) {
    for (const match of content.toString('utf8').matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)) {
      const target = match[1];
      assert.ok([...files.keys()].some(file => file === target || file === target + '.md' || path.posix.basename(file, '.md') === target), 'Link sem destino: ' + name + ' -> ' + target);
    }
  }
  const guide = `# Screenshots do Notaê

Este pacote contém apenas exemplos fictícios, criados para demonstrar o projeto.

## Abrir a demonstração

1. Extraia o ZIP.
2. No Obsidian, abra a pasta **Notaê Demo** como um vault separado.
3. Habilite o plugin **Notaê** nos plugins da comunidade se estiver de acordo com o aviso de confiança.
4. Abra **00 - Início** e use a visualização de leitura. Se necessário, ative o trecho CSS **faculdade** em Aparência.

## Capturas sugeridas

1. **Página inicial:** três botões no topo, conteúdos recentes e listas de disciplinas e estudos. Uma janela maior e o painel lateral fechado ajudam a mostrar mais conteúdo.
2. **Adicionar conteúdo:** entre em Git e GitHub e clique em Adicionar conteúdo. Preencha o título **Resolvendo conflitos** e o texto **Registrar um exemplo de conflito e como resolvê-lo.** Capture antes de guardar.
3. **Estudo organizado:** abra Git e GitHub ou Linux. Mostre as listas de anotações, práticas e materiais, com a pasta correspondente expandida no explorador.
4. **Nota de prática:** abra Linux → Práticas → Permissões de arquivos para mostrar uma nota preenchida.
5. **GIF opcional:** use Novo estudo independente para criar **Docker**. Esse tema foi deixado fora da demonstração para você mostrar a criação ao vivo.

Use o mesmo tema e escala nas imagens. Feche outros vaults, conversas e painéis pessoais antes de capturar. Não é necessário instalar outro plugin nem conectar contas.

## Depois de capturar

As notas desta demonstração não entram no pacote público vazio. Para recomeçar, extraia este ZIP em uma nova pasta. Não extraia por cima do seu vault pessoal.
`;
  const entries = [...files].map(([name, data]) => ['Notaê Demo/' + name, data]);
  entries.push(['Notaê Demo/LICENSE', fs.readFileSync(path.join(root, 'LICENSE'))]);
  entries.push(['GUIA-SCREENSHOTS.md', Buffer.from(guide, 'utf8')]);
  entries.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  const archive = zip(entries);
  const destination = path.join(root, 'dist');
  fs.mkdirSync(destination, { recursive: true });
  const filename = 'notae-demo-screenshots.zip';
  fs.writeFileSync(path.join(destination, filename), archive);
  fs.writeFileSync(path.join(destination, filename + '.sha256'), crypto.createHash('sha256').update(archive).digest('hex') + '  ' + filename + '\n');
  console.log('Gerado dist/' + filename + ': 3 disciplinas, 2 estudos, 15 notas de conteúdo e um guia de screenshots.');
  console.log('Arquivos no ZIP: ' + entries.length + '. Todos os links internos foram conferidos.');
}

if (require.main === module) buildDemo();
module.exports = { buildDemo };
