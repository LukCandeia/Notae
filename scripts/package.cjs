'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { check } = require('./check.cjs');
const { VAULT_FILES } = require('./files.cjs');
const root = path.resolve(__dirname, '..');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Standard ZIP, UTF-8 filenames, fixed timestamps; includes dotfolders explicitly.
function zip(entries) {
  const chunks = [], directory = [];
  let offset = 0;
  for (const [entryName, data] of entries) {
    const name = Buffer.from(entryName, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12); // 1980-01-01, deterministic release archive.
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    chunks.push(header, name, compressed);
    directory.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const directoryBuffer = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directoryBuffer, end]);
}

function buildPackage() {
  check();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const entries = VAULT_FILES.map(file => ['Notaê/' + file, fs.readFileSync(path.join(root, 'vault', file))]);
  entries.push(['Notaê/LICENSE', fs.readFileSync(path.join(root, 'LICENSE'))]);
  entries.push(['LEIA-ME.txt', Buffer.from('Notaê — Clareza para organizar seus estudos.\n\nExtraia este ZIP. No Obsidian, abra a pasta Notaê como vault.\nHabilite o complemento Notaê em Configurações > Plugins da comunidade, se estiver de acordo com o aviso de confiança.\nAbra Comece aqui.md para aprender a usar.\n\nAutoria: LukCandeia. Licença MIT incluída.\nAndroid ainda requer teste manual desta edição. Não inclui sincronização ou lembretes.\n', 'utf8')]);
  entries.sort((a, b) => a[0].localeCompare(b[0], 'en'));
  const archive = zip(entries);
  const output = path.join(root, 'dist');
  fs.mkdirSync(output, { recursive: true });
  const filename = 'notae-v' + pkg.version + '.zip';
  fs.writeFileSync(path.join(output, filename), archive);
  const digest = crypto.createHash('sha256').update(archive).digest('hex');
  fs.writeFileSync(path.join(output, filename + '.sha256'), digest + '  ' + filename + '\n');
  console.log('Gerado dist/' + filename + ' (' + entries.length + ' arquivos). SHA-256: ' + digest);
  return { archive, entries, filename };
}

if (require.main === module) buildPackage();
module.exports = { zip, crc32, buildPackage };
