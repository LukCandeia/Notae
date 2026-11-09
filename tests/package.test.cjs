'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { VAULT_FILES } = require('../scripts/files.cjs');
const { zip, crc32 } = require('../scripts/package.cjs');
const { check } = require('../scripts/check.cjs');

test('the release template contains only approved public files and valid links', () => {
  assert.equal(check(), 21);
});

test('release validation refuses a private note added to the model', () => {
  const project = path.resolve(__dirname, '..');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notae-check-'));
  try {
    for (const relative of [...VAULT_FILES.map(file => 'vault/' + file), 'LICENSE', 'package.json']) {
      const destination = path.join(tempRoot, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(project, relative), destination);
    }
    assert.equal(check(tempRoot), 21);
    fs.writeFileSync(path.join(tempRoot, 'vault/Para organizar/Nota particular.md'), 'Conteúdo fictício que não deve entrar na distribuição.');
    assert.throws(() => check(tempRoot), /apenas os arquivos públicos/);
  } finally {
    const absoluteTemp = path.resolve(tempRoot);
    assert.ok(absoluteTemp.startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(absoluteTemp).startsWith('notae-check-'));
    fs.rmSync(absoluteTemp, { recursive: true, force: true });
  }
});

test('ZIP preserves Unicode paths, hidden plugin files and their contents', () => {
  const entries = [
    ['Notaê/00 - Início.md', Buffer.from('# Meus estudos\n', 'utf8')],
    ['Notaê/.obsidian/plugins/notae/main.js', Buffer.from('module.exports = {};\n')],
    ['Notaê/Estudos independentes/.gitkeep', Buffer.alloc(0)]
  ];
  const archive = zip(entries);
  const endOffset = archive.length - 22;
  assert.equal(archive.readUInt32LE(endOffset), 0x06054b50);
  assert.equal(archive.readUInt16LE(endOffset + 10), entries.length);
  let centralOffset = archive.readUInt32LE(endOffset + 16);
  for (const [name, expected] of entries) {
    assert.equal(archive.readUInt32LE(centralOffset), 0x02014b50);
    const nameLength = archive.readUInt16LE(centralOffset + 28);
    assert.equal(archive.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8'), name);
    const localOffset = archive.readUInt32LE(centralOffset + 42);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50);
    assert.equal(archive.readUInt16LE(localOffset + 6), 0x0800);
    const compressedLength = archive.readUInt32LE(localOffset + 18);
    const contentOffset = localOffset + 30 + archive.readUInt16LE(localOffset + 26);
    const actual = zlib.inflateRawSync(archive.subarray(contentOffset, contentOffset + compressedLength));
    assert.deepEqual(actual, expected);
    assert.equal(archive.readUInt32LE(localOffset + 14), crc32(actual));
    centralOffset += 46 + nameLength;
  }
});
