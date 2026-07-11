#!/usr/bin/env node
/** Synchronize zh/ja Google Fonts text subsets with visible <body> text. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configs = [
  { dir: 'zh', family: 'Noto+Sans+TC' },
  { dir: 'ja', family: 'Noto+Sans+JP' },
];
const named = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©',
  times: '×', middot: '·', hellip: '…', mdash: '—', ndash: '–', rarr: '→',
};

function decodeEntities(text) {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const hex = body[1]?.toLowerCase() === 'x';
      const value = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : all;
    }
    return named[body.toLowerCase()] ?? all;
  });
}

function visibleBodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  return decodeEntities(body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\n\f]+/g, ' ')
    .trim();
}

function pagesIn(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pagesIn(full));
    else if (entry.name === 'index.html') found.push(full);
  }
  return found;
}

for (const config of configs) {
  for (const file of pagesIn(path.join(ROOT, config.dir))) {
    const html = fs.readFileSync(file, 'utf8');
    const uniqueText = [...new Set([...visibleBodyText(html)])].join('');
    const encoded = encodeURIComponent(uniqueText);
    const family = config.family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkRe = new RegExp(
      '(https:\\/\\/fonts\\.googleapis\\.com\\/css2\\?family=' + family
      + '[^"\\s>]*?(?:&amp;|&)text=)[^"]*?((?:&amp;|&)display=)',
    );
    if (!linkRe.test(html)) throw new Error(path.relative(ROOT, file) + ': font text link not found');
    const next = html.replace(linkRe, '$1' + encoded + '$2');
    fs.writeFileSync(file, next, 'utf8');
    console.log(path.relative(ROOT, file).split(path.sep).join('/') + ': ' + [...uniqueText].length + ' unique visible characters');
  }
}
