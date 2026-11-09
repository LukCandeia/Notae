'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { VAULT_FILES } = require('./files.cjs');
const root = path.resolve(__dirname, '..');

function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), 'Links simbólicos não são permitidos: ' + relative);
    return entry.isDirectory() ? walk(path.join(dir, entry.name), relative + '/') : [relative];
  });
}

function check(projectRoot = root) {
  const vault = path.join(projectRoot, 'vault');
  assert.deepEqual(walk(vault).sort(), [...VAULT_FILES].sort(), 'O vault deve conter apenas os arquivos públicos listados em scripts/files.cjs.');
  const read = relative => fs.readFileSync(path.join(vault, relative), 'utf8');
  for (const relative of VAULT_FILES) {
    const content = read(relative);
    assert.ok(!/[A-Z]:[\\/]+Users[\\/]+/i.test(content), 'Caminho pessoal em ' + relative);
    assert.ok(!/github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/.test(content), 'Possível credencial em ' + relative);
    for (const forbidden of ['Personalizado para este vault', '.claudian/sessions/', 'claudian-settings.json', '-----BEGIN PRIVATE KEY-----']) {
      assert.ok(!content.includes(forbidden), 'Conteúdo da instalação pessoal em ' + relative);
    }
    if (relative.endsWith('.json')) JSON.parse(content);
    if (relative.endsWith('.js')) new vm.Script(content, { filename: relative });
    if (!relative.endsWith('.md')) continue;
    for (const match of content.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)) {
      const link = match[1];
      const exists = VAULT_FILES.some(candidate => candidate === link || candidate === link + '.md' || path.posix.basename(candidate, '.md') === link);
      assert.ok(exists, 'Link interno sem destino em ' + relative + ': ' + link);
    }
    for (const match of content.matchAll(/\]\((obsidian:[^)]+)\)/g)) {
      const url = new URL(match[1]);
      assert.equal(url.protocol, 'obsidian:');
      assert.equal(url.hostname, 'notae');
      assert.ok(!url.searchParams.has('vault'), 'O nome do vault deve ser livre.');
      assert.ok(['conteudo', 'nova-disciplina', 'novo-estudo'].includes(url.searchParams.get('acao')));
    }
  }
  assert.deepEqual(JSON.parse(read('.obsidian/community-plugins.json')), ['notae']);
  const manifest = JSON.parse(read('.obsidian/plugins/notae/manifest.json'));
  assert.equal(manifest.id, 'notae');
  assert.equal(manifest.author, 'LukCandeia');
  assert.equal(manifest.name, 'Notaê');
  const home = read('00 - Início.md');
  for (const action of ['conteudo', 'nova-disciplina', 'novo-estudo']) {
    const button = 'acao=' + action + ')';
    assert.equal(home.split(button).length - 1, 1);
    assert.ok(home.indexOf(button) < home.indexOf('## Adicionados recentemente'));
  }
  for (const block of ['faculdade-recentes', 'faculdade-disciplinas', 'faculdade-estudos']) assert.ok(home.includes('```' + block));
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'notae');
  assert.equal(pkg.license, 'MIT');
  const license = fs.readFileSync(path.join(projectRoot, 'LICENSE'), 'utf8');
  assert.ok(license.startsWith('MIT License\n'));
  assert.ok(license.includes('Copyright (c) 2026 LukCandeia'));
  return VAULT_FILES.length;
}

if (require.main === module) console.log('Modelo verificado: ' + check() + ' arquivos públicos, JSON, JavaScript, botões, links internos, licença e autoria.');
module.exports = { check };
