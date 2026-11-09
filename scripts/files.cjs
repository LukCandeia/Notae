'use strict';

// Explicit release manifest: never derive public content from a personal vault.
const VAULT_FILES = [
  '00 - Início.md',
  'Comece aqui.md',
  'Ajuda rápida.md',
  'Disciplinas/.gitkeep',
  'Estudos independentes/.gitkeep',
  'Modelos/Aula.md',
  'Modelos/Exercício.md',
  'Modelos/Material.md',
  'Modelos/Trabalho ou prova.md',
  'Para organizar/Caixa de entrada.md',
  'Para organizar/Arquivos/.gitkeep',
  '.obsidian/app.json',
  '.obsidian/appearance.json',
  '.obsidian/bookmarks.json',
  '.obsidian/community-plugins.json',
  '.obsidian/core-plugins.json',
  '.obsidian/templates.json',
  '.obsidian/plugins/notae/main.js',
  '.obsidian/plugins/notae/manifest.json',
  '.obsidian/plugins/notae/styles.css',
  '.obsidian/snippets/faculdade.css'
];

module.exports = { VAULT_FILES };
