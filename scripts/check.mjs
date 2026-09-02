#!/usr/bin/env node
/**
 * check.mjs — linku.tech 靜態站機械化檢查（零依賴，Node 20+，僅用 node: 內建模組）
 *
 * 用法：node scripts/check.mjs   （任何工作目錄皆可，路徑以本檔位置推導）
 * 任一 FAIL → exit code 1（供 CI 擋下，錯誤不再靜默上線）。
 *
 * 檢查項目：
 *  1. 頁面掃描：對 repo 內所有 index.html —
 *     - <html lang> 與檔案位置一致（zh/** → zh-Hant、ja/** → ja、其餘 → en）
 *     - self-canonical：<link rel="canonical"> 與檔案位置推導的 URL 一致
 *     - hreflang 組完整：恰為 en / zh-Hant / ja / x-default 四項、無重複
 *     - 三語互指一致：hreflang 指到的每一頁都實際存在，且對方頁面的
 *       hreflang 四項與本頁完全相同（互指成環）；本頁自身語言的 hreflang
 *       必須等於自身 canonical
 *  2. sitemap.xml 與實際頁面雙向一致（沒漏頁、也沒多出不存在的頁）
 *  3. Google Fonts &text= 子集檢查（本站最容易踩的坑）：
 *     - 依 <html lang> 決定字族：zh-Hant → Noto+Sans+TC、ja → Noto+Sans+JP
 *     - 從 assets/styles.css 解析 html[lang="zh-Hant"] / html[lang="ja"] 區塊中
 *       font-family 使用 var(--cjk-display|--cjk-body) 的選擇器，支援兩種形態：
 *         html[lang=..] .class        （例：.hero-title）
 *         html[lang=..] .class tag    （例：.about-facts dd、.nav-links a）
 *       出現其他形態的選擇器時直接 FAIL（要求擴充本腳本，不靜默略過，避免漏檢）
 *     - 從 HTML 抽出這些元素的可見文字（略過 <script>/<style> 內容與註解，
 *       HTML 實體如 &copy;、&#8594; 先解碼），其中每個 CJK 字元都必須
 *       包含在該頁 &text= 參數內；缺字即 FAIL 並列出缺哪些字、在哪個選擇器
 *  4. 資源預算與引用完整性（2026-07-08 rendering-upgrade P0 新增）：
 *     - assets/*.js / *.css 的 Brotli 壓縮位元組數不得超過預算表（貼近實際傳輸成本）；
 *       預算表中標記 optional 的檔案「不存在」不算 FAIL（尚未實作的階段），
 *       但只要存在就必須守預算
 *     - 頁面上引用的本地 /assets/ 資源（script src、link href）必須實際存在
 *  5. 外部 origin 白名單（2026-07-08 rendering-upgrade P0 新增）：
 *     - 所有頁面的 <script src> / <link href> 外部 origin 僅允許
 *       fonts.googleapis.com、fonts.gstatic.com；其他一律 FAIL（守住零依賴）
 *  6. 漸進增強與語義：每頁恰有一個 main、skip link、不跳級的標題；
 *     reveal 與自訂游標只在 JS／游標確實啟動後才隱藏原生內容／游標
 *  7. 對外可信度與 Organization JSON-LD 的跨語一致性
 *  8. Metadata／互動安全／i18n 細節與明示語言 URL 回歸
 *  9. Vercel 安全標頭與嚴格 CSP 相容性
 *
 * 檢查範圍與已知限制（改動站台結構前先讀）：
 *  - 「CJK 字元」定義：漢字（U+4E00–9FFF、擴展A U+3400–4DBF、相容區 U+F900–FAFF）、
 *    平假名/片假名（U+3040–30FF、U+31F0–31FF）、CJK 標點（U+3000–303F，含 。、「」）、
 *    全形符號（U+FF00–FFEF，含 ，？：（）；）。em dash（——，U+2014）、中點（·，
 *    U+00B7）、×（U+00D7）、箭頭（→ ↗）等「非 CJK 區段」的字元不納入檢查——
 *    它們 fallback 的視覺差異小，納入會產生噪音。
 *  - HTML 解析為簡化實作（堆疊式標籤解析），不處理 CSS 造成的不可見
 *    （display:none 等）；本站目前無此情形。過度收集只會讓檢查偏嚴，不會漏檢。
 *  - 站台網域寫死為 https://linku.tech（canonical 推導用）。
 *  - CSS 選擇器解析僅支援上列兩種形態；若未來加入更複雜選擇器
 *    （偽類、多層 combinator 等），本腳本會 FAIL 提示擴充，而非靜默跳過。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://linku.tech';
const HREFLANG_KEYS = ['en', 'zh-Hant', 'ja', 'x-default'];

let passCount = 0;
let failCount = 0;
function pass(msg) { passCount++; console.log('[PASS] ' + msg); }
function fail(msg) { failCount++; console.log('[FAIL] ' + msg); }

// ---------- 通用工具 ----------

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
}

function relOf(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', times: '×', middot: '·', hellip: '…',
  mdash: '—', ndash: '–', rarr: '→',
};

function decodeEntities(s) {
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const code = (body[1] === 'x' || body[1] === 'X')
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? all;
  });
}

function isCJK(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x3000 && c <= 0x303F)   // CJK 標點（。、「」等）
      || (c >= 0x3040 && c <= 0x30FF)   // 平假名・片假名
      || (c >= 0x31F0 && c <= 0x31FF)   // 片假名語音擴展
      || (c >= 0x3400 && c <= 0x4DBF)   // 漢字擴展 A
      || (c >= 0x4E00 && c <= 0x9FFF)   // 漢字
      || (c >= 0xF900 && c <= 0xFAFF)   // 相容漢字
      || (c >= 0xFF00 && c <= 0xFFEF);  // 全形符號・半形片假名
}

// ---------- 頁面探索 ----------

function findIndexHtml(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      findIndexHtml(path.join(dir, e.name), acc);
    } else if (e.name === 'index.html') {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

function urlOf(file) {
  const relDir = path.relative(ROOT, path.dirname(file)).split(path.sep).join('/');
  return relDir === '' ? SITE + '/' : SITE + '/' + relDir + '/';
}

function expectedLangOf(file) {
  const rel = relOf(file);
  if (rel === 'zh/index.html' || rel.startsWith('zh/')) return 'zh-Hant';
  if (rel === 'ja/index.html' || rel.startsWith('ja/')) return 'ja';
  return 'en';
}

// ---------- HTML 屬性 / <link> 解析（head 中繼資料用） ----------

function attrsOfTag(tagStr) {
  const attrs = {};
  const inner = tagStr.replace(/^<[a-zA-Z][a-zA-Z0-9-]*/, '').replace(/\/?\s*>$/, '');
  const re = /([a-zA-Z][a-zA-Z0-9:_-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (const m of inner.matchAll(re)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

// Inline scripts are forbidden by the deployed CSP unless they are inert
// structured data. Whitelist only JSON-LD: `type="module"`, classic JavaScript
// MIME types, import maps, empty/unknown types, and future executable types must
// all fail closed instead of being skipped merely because `type` is present.
function inlineNonJsonScripts(html) {
  const scripts = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = attrsOfTag('<script' + match[1] + '>');
    if (attrs.src) continue;
    const type = String(attrs.type || '').trim().toLowerCase().split(';', 1)[0].trim();
    if (type === 'application/ld+json') continue;
    scripts.push({ type: type || '(classic)', code: match[2] });
  }
  return scripts;
}

function parseHead(html) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrsOfTag(m[0]));
  const langMatch = html.match(/<html\b[^>]*\blang\s*=\s*"([^"]*)"/i);
  const lang = langMatch ? langMatch[1] : null;
  let canonical = null;
  const alternates = new Map();
  const duplicateKeys = [];
  for (const a of links) {
    const rel = (a.rel || '').toLowerCase();
    if (rel === 'canonical') canonical = decodeEntities(a.href || '');
    if (rel === 'alternate' && a.hreflang) {
      const key = a.hreflang;
      const href = decodeEntities(a.href || '');
      if (alternates.has(key)) duplicateKeys.push(key);
      alternates.set(key, href);
    }
  }
  return { lang, canonical, alternates, duplicateKeys, links };
}

// ---------- HTML 樹解析（可見文字抽取用） ----------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function parseHTMLTree(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      if (html.startsWith('<!--', i)) {
        const end = html.indexOf('-->', i + 4);
        i = end === -1 ? html.length : end + 3;
      } else if (html.startsWith('<!', i)) {
        const end = html.indexOf('>', i);
        i = end === -1 ? html.length : end + 1;
      } else if (html.startsWith('</', i)) {
        const end = html.indexOf('>', i);
        const name = html.slice(i + 2, end === -1 ? html.length : end).trim().toLowerCase();
        for (let s = stack.length - 1; s >= 1; s--) {
          if (stack[s].tag === name) { stack.length = s; break; }
        }
        i = end === -1 ? html.length : end + 1;
      } else {
        const end = html.indexOf('>', i);
        if (end === -1) break;
        const raw = html.slice(i + 1, end);
        const selfClose = /\/\s*$/.test(raw);
        const inner = selfClose ? raw.replace(/\/\s*$/, '') : raw;
        const nameMatch = inner.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
        if (!nameMatch) { i = end + 1; continue; }
        const tag = nameMatch[1].toLowerCase();
        const node = { tag, attrs: attrsOfTag('<' + inner + '>'), children: [] };
        top().children.push(node);
        i = end + 1;
        if (tag === 'script' || tag === 'style') {
          // raw-text 元素：內容不是可見文字，直接跳到結尾標籤
          const rest = html.slice(i);
          const m = rest.match(new RegExp('</' + tag + '\\s*>', 'i'));
          i = m ? i + m.index + m[0].length : html.length;
        } else if (!selfClose && !VOID_ELEMENTS.has(tag)) {
          stack.push(node);
        }
      }
    } else {
      const next = html.indexOf('<', i);
      const text = html.slice(i, next === -1 ? html.length : next);
      if (text.trim()) top().children.push({ text });
      i = next === -1 ? html.length : next;
    }
  }
  return root;
}

function walk(node, cb) {
  cb(node);
  if (node.children) for (const c of node.children) walk(c, cb);
}

function hasClass(node, cls) {
  return node.attrs && typeof node.attrs.class === 'string'
    && node.attrs.class.split(/\s+/).includes(cls);
}

function textOf(node) {
  const parts = [];
  walk(node, (n) => { if (n.text !== undefined) parts.push(n.text); });
  return decodeEntities(parts.join(''));
}

// ---------- CSS 解析：找出使用 CJK 字型的選擇器 ----------

function extractCssRules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  let buf = '';
  while (i < css.length) {
    const ch = css[i];
    if (ch === '{') {
      const selector = buf.trim();
      buf = '';
      let depth = 1;
      let j = i + 1;
      const start = j;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      const body = css.slice(start, j - 1);
      if (selector.startsWith('@')) {
        if (/^@(media|supports)\b/.test(selector)) rules.push(...extractCssRules(body));
        // @keyframes 等其他 at-rule 與字型檢查無關，略過
      } else {
        rules.push({ selector, body });
      }
      i = j;
    } else if (ch === '}') {
      buf = '';
      i++;
    } else {
      buf += ch;
      i++;
    }
  }
  return rules;
}

/**
 * 回傳 { targets: [{cls, tag|null, desc}], errors: [string] }
 * targets = 在指定 lang 下 font-family 使用 var(--cjk-*) 的元素選擇器
 */
function cjkTargetsForLang(cssRules, lang) {
  const fontRuleRe = /font-family\s*:[^;]*var\(--cjk-(?:display|body)\)/;
  const targets = new Map();
  const errors = [];
  const prefixRe = new RegExp('^html\\[lang="' + lang + '"\\]\\s+(.+)$');
  for (const rule of cssRules) {
    if (!fontRuleRe.test(rule.body)) continue;
    for (const part of rule.selector.split(',').map((s) => s.trim())) {
      const m = part.match(prefixRe);
      if (!m) continue; // 其他語言或無關選擇器
      const rest = m[1].trim();
      let t = rest.match(/^\.([A-Za-z0-9_-]+)$/);
      if (t) {
        targets.set('.' + t[1], { cls: t[1], tag: null, desc: '.' + t[1] });
        continue;
      }
      t = rest.match(/^\.([A-Za-z0-9_-]+)\s+([a-zA-Z][a-zA-Z0-9-]*)$/);
      if (t) {
        targets.set('.' + t[1] + ' ' + t[2], { cls: t[1], tag: t[2].toLowerCase(), desc: '.' + t[1] + ' ' + t[2] });
        continue;
      }
      errors.push('styles.css 選擇器「' + part + '」形態不受支援，無法可靠判定檢查範圍；請擴充 scripts/check.mjs 的選擇器解析（不可靜默略過）');
    }
  }
  return { targets: [...targets.values()], errors };
}

function matchElements(tree, target) {
  const matched = [];
  walk(tree, (n) => {
    if (!hasClass(n, target.cls)) return;
    if (!target.tag) {
      matched.push(n);
    } else {
      walk(n, (d) => {
        if (d !== n && d.tag === target.tag) matched.push(d);
      });
    }
  });
  return matched;
}

// ---------- &text= 抽取 ----------

function fontSubsetOf(headLinks, familyToken) {
  for (const a of headLinks) {
    const href = decodeEntities(a.href || '');
    if (!href.includes('fonts.googleapis.com')) continue;
    if (!href.includes('family=' + familyToken)) continue;
    const m = href.match(/[?&]text=([^&]*)/);
    if (!m) return { linkFound: true, text: null };
    let val = m[1];
    try { val = decodeURIComponent(val); } catch { /* 保留原字串 */ }
    return { linkFound: true, text: val };
  }
  return { linkFound: false, text: null };
}

// =============================================================
// 主流程
// =============================================================

const pageFiles = findIndexHtml(ROOT).sort();
if (pageFiles.length === 0) {
  fail('repo 內找不到任何 index.html（掃描根目錄：' + ROOT + '）');
}

// 先全部解析（互指一致性需要跨頁比對）
const pages = pageFiles.map((file) => {
  const html = readText(file);
  const head = parseHead(html);
  return {
    file,
    rel: relOf(file),
    url: urlOf(file),
    expectedLang: expectedLangOf(file),
    html,
    ...head,
  };
});
const pageByUrl = new Map(pages.map((p) => [p.url, p]));

// ---------- 1. 頁面掃描：lang / canonical / hreflang ----------
console.log('=== 1. 頁面掃描：lang / canonical / hreflang ===');

for (const p of pages) {
  const errs = [];

  if (!p.lang) {
    errs.push('<html> 缺少 lang 屬性');
  } else if (p.lang !== p.expectedLang) {
    errs.push('<html lang="' + p.lang + '"> 與檔案位置不符（預期 ' + p.expectedLang + '）');
  }

  if (!p.canonical) {
    errs.push('缺少 <link rel="canonical">');
  } else if (p.canonical !== p.url) {
    errs.push('canonical 不是 self-canonical：頁面寫 ' + p.canonical + '，檔案位置推導為 ' + p.url);
  }

  const keys = [...p.alternates.keys()];
  const missingKeys = HREFLANG_KEYS.filter((k) => !keys.includes(k));
  const extraKeys = keys.filter((k) => !HREFLANG_KEYS.includes(k));
  if (missingKeys.length) errs.push('hreflang 缺少：' + missingKeys.join('、'));
  if (extraKeys.length) errs.push('hreflang 多出未知項：' + extraKeys.join('、'));
  if (p.duplicateKeys.length) errs.push('hreflang 重複宣告：' + p.duplicateKeys.join('、'));

  // 自身語言的 hreflang 必須等於自身 canonical（即自身 URL）
  if (p.lang && HREFLANG_KEYS.includes(p.lang) && p.alternates.has(p.lang)) {
    if (p.alternates.get(p.lang) !== p.url) {
      errs.push('hreflang ' + p.lang + '（自身語言）指向 ' + p.alternates.get(p.lang) + '，應為 ' + p.url);
    }
  }

  // 互指一致：每個 hreflang 目標頁要存在，且四項 hreflang 與本頁完全相同
  for (const [key, href] of p.alternates) {
    if (!HREFLANG_KEYS.includes(key)) continue;
    const target = pageByUrl.get(href);
    if (!target) {
      errs.push('hreflang ' + key + ' 指向不存在的頁面：' + href);
      continue;
    }
    if (key !== 'x-default' && target !== p) {
      for (const k of HREFLANG_KEYS) {
        const mine = p.alternates.get(k);
        const theirs = target.alternates.get(k);
        if (mine !== undefined && theirs !== undefined && mine !== theirs) {
          errs.push('與 ' + target.rel + ' 互指不一致：hreflang ' + k + ' 本頁=' + mine + '、對方=' + theirs);
        }
      }
    }
  }

  if (errs.length === 0) {
    pass(p.rel + ' — lang=' + p.lang + '、self-canonical、hreflang 四項完整且互指一致');
  } else {
    for (const e of errs) fail(p.rel + ' — ' + e);
  }
}

// ---------- 2. sitemap.xml 雙向一致 ----------
console.log('');
console.log('=== 2. sitemap.xml 與實際頁面雙向一致 ===');

const sitemapPath = path.join(ROOT, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  fail('找不到 sitemap.xml：' + sitemapPath);
} else {
  const sitemapXml = readText(sitemapPath);
  const locs = [...sitemapXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
  const locSet = new Set(locs);
  if (locs.length !== locSet.size) {
    fail('sitemap.xml 有重複的 <loc>');
  }
  const missingInSitemap = pages.filter((p) => !locSet.has(p.url));
  const extraInSitemap = [...locSet].filter((u) => !pageByUrl.has(u));
  for (const p of missingInSitemap) fail('sitemap 漏頁：' + p.url + '（' + p.rel + '）');
  for (const u of extraInSitemap) fail('sitemap 多出不存在的頁：' + u);
  if (missingInSitemap.length === 0 && extraInSitemap.length === 0 && locs.length === locSet.size) {
    pass('sitemap.xml 與實際頁面一致（共 ' + pages.length + ' 頁）');
  }
}

// ---------- 3. Google Fonts &text= 子集檢查 ----------
console.log('');
console.log('=== 3. Google Fonts &text= 子集檢查（zh / ja 頁） ===');

const stylesPath = path.join(ROOT, 'assets', 'styles.css');
const FAMILY_BY_LANG = { 'zh-Hant': 'Noto+Sans+TC', 'ja': 'Noto+Sans+JP' };

if (!fs.existsSync(stylesPath)) {
  fail('找不到 assets/styles.css，無法判定 CJK 字型選擇器');
} else {
  const cssRules = extractCssRules(readText(stylesPath));
  const targetsByLang = {};
  for (const lang of Object.keys(FAMILY_BY_LANG)) {
    const { targets, errors } = cjkTargetsForLang(cssRules, lang);
    targetsByLang[lang] = targets;
    for (const e of errors) fail('[' + lang + '] ' + e);
    if (targets.length === 0) {
      fail('styles.css 中找不到 html[lang="' + lang + '"] 的 CJK 字型選擇器（var(--cjk-*)），檢查無法進行');
    }
  }

  for (const p of pages) {
    const lang = p.lang && FAMILY_BY_LANG[p.lang] ? p.lang : (FAMILY_BY_LANG[p.expectedLang] ? p.expectedLang : null);
    if (!lang) continue; // en 頁不需 CJK 子集
    const family = FAMILY_BY_LANG[lang];
    const targets = targetsByLang[lang] || [];
    if (targets.length === 0) continue; // 上面已 FAIL

    const subset = fontSubsetOf(p.links, family);
    if (!subset.linkFound) {
      fail(p.rel + ' — 找不到 ' + family.replace(/\+/g, ' ') + ' 的 Google Fonts <link>');
      continue;
    }
    if (subset.text === null) {
      fail(p.rel + ' — ' + family.replace(/\+/g, ' ') + ' 的 <link> 沒有 &text= 參數（本站慣例為子集載入）');
      continue;
    }
    const subsetChars = new Set([...subset.text]);

    // 從 HTML 抽出 CJK 字型元素的可見文字
    const tree = parseHTMLTree(p.html);
    const required = new Map(); // char -> Set(selector desc)
    for (const t of targets) {
      for (const el of matchElements(tree, t)) {
        for (const ch of textOf(el)) {
          if (!isCJK(ch)) continue;
          if (!required.has(ch)) required.set(ch, new Set());
          required.get(ch).add(t.desc);
        }
      }
    }

    const missing = [...required.entries()].filter(([ch]) => !subsetChars.has(ch));
    let body = null;
    walk(tree, (node) => { if (!body && node.tag === 'body') body = node; });
    const visibleBodyCJK = new Set(body ? [...textOf(body)].filter(isCJK) : []);
    const stale = [...subsetChars].filter((ch) => isCJK(ch) && !visibleBodyCJK.has(ch));
    if (missing.length === 0 && stale.length === 0) {
      pass(p.rel + ' — CJK 字型子集涵蓋必要字元，且無過期 CJK 字元');
    } else if (missing.length > 0) {
      const detail = missing
        .map(([ch, descs]) => '「' + ch + '」(U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + '，出現於 ' + [...descs].join('、') + ')')
        .join('；');
      fail(p.rel + ' — &text= 缺 ' + missing.length + ' 字：' + detail);
    }
    if (stale.length > 0) {
      fail(p.rel + ' — &text= 含 ' + stale.length + ' 個頁面正文已不存在的 CJK 字元：' + stale.join(''));
    }
  }
}

// ---------- 4. 資源預算與引用完整性 ----------
console.log('');
console.log('=== 4. 資源預算與本地引用完整性 ===');

// 預算為 Brotli quality 11 位元組數；比未壓縮大小更貼近實際傳輸成本，
// 並保留約 20% 維護空間。optional=true 僅供「尚未實作的未來檔案」使用——
// 已上線資產一律 optional:false（檔案消失＝FAIL，防 rename／誤刪讓功能
// 靜默蒸發而 CI 全綠）。調整門檻請同步更新任務簡報。
const ASSET_BUDGETS = [
  { rel: 'assets/render.js', maxBytes: 18 * 1024, optional: false },
  { rel: 'assets/proof.js',  maxBytes: 7 * 1024, optional: false },
  { rel: 'assets/main.js',   maxBytes: 4 * 1024, optional: false },
  { rel: 'assets/styles.css', maxBytes: 10 * 1024, optional: false },
];

// script src 抽取共用 helper：走 attrsOfTag（與 <link> 解析同一條路），
// 單引號／無引號屬性一樣抓得到——§4 與 §5 必須對「頁面載入了什麼」
// 有同一份答案，否則白名單會漏
function scriptSrcsOf(p) {
  return [...p.html.matchAll(/<script\b[^>]*>/gi)]
    .map((m) => attrsOfTag(m[0]))
    .filter((a) => a.src)
    .map((a) => decodeEntities(a.src));
}

for (const b of ASSET_BUDGETS) {
  const file = path.join(ROOT, ...b.rel.split('/'));
  if (!fs.existsSync(file)) {
    if (b.optional) pass(b.rel + ' — 尚未存在（optional，跳過預算檢查）');
    else fail(b.rel + ' — 檔案不存在（必要資產）');
    continue;
  }
  const size = brotliCompressSync(fs.readFileSync(file), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
  if (size <= b.maxBytes) {
    pass(b.rel + ' — Brotli ' + size + ' bytes ≤ 預算 ' + b.maxBytes + ' bytes');
  } else {
    fail(b.rel + ' — Brotli ' + size + ' bytes 超出預算 ' + b.maxBytes + ' bytes（效能護欄；若為刻意擴充請連同任務簡報一起調整）');
  }
}

// 頁面引用的本地 /assets/ 資源必須存在（防 script/css 改名或誤刪後靜默 404）
{
  const missingRefs = [];
  for (const p of pages) {
    const refs = [
      ...scriptSrcsOf(p),
      ...p.links.map((a) => decodeEntities(a.href || '')),
    ];
    for (const href of refs) {
      // 只有單斜線開頭＝本地絕對路徑；「//host/...」是 protocol-relative
      // 外部 URL，歸 §5 白名單管
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const clean = href.split(/[?#]/)[0];
      const file = path.join(ROOT, ...clean.split('/').filter(Boolean));
      if (!fs.existsSync(file)) missingRefs.push(p.rel + ' 引用了不存在的 ' + clean);
    }
  }
  if (missingRefs.length === 0) {
    pass('九頁引用的本地資源全部存在');
  } else {
    for (const m of missingRefs) fail(m);
  }
}

// ---------- 5. 外部 origin 白名單 ----------
console.log('');
console.log('=== 5. 外部 origin 白名單（script src / link href） ===');

const ALLOWED_ORIGINS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
// 只檢查「會觸發資源抓取／連線」的 link rel；canonical、alternate 等純中繼資料
// 指向本站 URL，屬 §1 的檢查範圍，不在資源白名單管轄內。
const FETCHING_RELS = new Set([
  'stylesheet', 'icon', 'shortcut icon', 'apple-touch-icon', 'manifest',
  'preload', 'prefetch', 'modulepreload', 'preconnect', 'dns-prefetch',
]);
{
  const offenders = [];
  for (const p of pages) {
    const urls = [
      ...scriptSrcsOf(p),
      ...p.links
        .filter((a) => FETCHING_RELS.has((a.rel || '').toLowerCase()))
        .map((a) => decodeEntities(a.href || '')),
    ];
    for (const href of urls) {
      const m = href.match(/^(?:https?:)?\/\/([^/]+)/i);
      if (!m) continue;                              // 本地路徑
      const host = m[1].toLowerCase();
      if (!ALLOWED_ORIGINS.has(host)) offenders.push(p.rel + ' 引用了白名單外的 origin：' + host + '（' + href + '）');
    }
  }
  if (offenders.length === 0) {
    pass('所有頁面的外部 origin 僅限 fonts.googleapis.com / fonts.gstatic.com');
  } else {
    for (const o of offenders) fail(o);
  }
}

// ---------- 6. 漸進增強與語義 ----------
console.log('');
console.log('=== 6. 漸進增強與語義結構 ===');
{
  const issues = [];
  for (const p of pages) {
    const mainCount = (p.html.match(/<main\b/gi) || []).length;
    if (mainCount !== 1) issues.push(p.rel + ' — <main> 數量為 ' + mainCount + '（預期 1）');
    if (!/<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#top["']/i.test(p.html)) {
      issues.push(p.rel + ' — 缺少指向 #top 的 skip link');
    }
    const levels = [...p.html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
    if (levels[0] !== 1) issues.push(p.rel + ' — 第一個標題不是 h1');
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) issues.push(p.rel + ' — 標題層級由 h' + levels[i - 1] + ' 跳至 h' + levels[i]);
    }
  }
  const css = readText(stylesPath);
  const mainJs = readText(path.join(ROOT, 'assets', 'main.js'));
  if (!/\.js\s+\.reveal\s*\{/.test(css)) issues.push('styles.css — reveal 未受 .js enhancement gate 保護');
  if (!/\.cursor-ready\s+body\s*\{/.test(css)) issues.push('styles.css — cursor:none 未受 .cursor-ready gate 保護');
  if (!/document\.documentElement\.classList\.add\(['"]js['"]\)/.test(mainJs.slice(0, 400))) {
    issues.push('main.js — 啟動區未設定 html.js enhancement gate');
  }
  if (issues.length === 0) pass('九頁 main／skip link／標題層級與 no-JS enhancement gates 完整');
  else for (const issue of issues) fail(issue);
}

// ---------- 7. 對外可信度與結構化資料 ----------
console.log('');
console.log('=== 7. 對外可信度與結構化資料一致性 ===');
{
  const issues = [];
  const descriptions = new Map();
  const banned = [
    /improving over time/i, /keeps learning/i, /data remains on-site/i,
    /performance beyond its spec/i, /越用越強/, /資料亦始終留存本地/,
    /使うほど賢く/, /データは手元に留まります/,
  ];
  for (const p of pages) {
    for (const pattern of banned) {
      if (pattern.test(p.html)) issues.push(p.rel + ' — 仍含未加條件的對外承諾：' + pattern);
    }
    const ldScripts = [...p.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    if (ldScripts.length !== 1) {
      issues.push(p.rel + ' — Organization JSON-LD 數量為 ' + ldScripts.length + '（預期 1）');
      continue;
    }
    try {
      const data = JSON.parse(ldScripts[0][1]);
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const org = nodes.find((node) => node && node['@type'] === 'Organization');
      if (!org) throw new Error('缺少 Organization node');
      if (org.foundingDate !== '2026') issues.push(p.rel + ' — JSON-LD foundingDate 應為 inception year 2026');
      if (!Array.isArray(org.sameAs) || !org.sameAs.includes('https://github.com/linkuofficial')) {
        issues.push(p.rel + ' — JSON-LD sameAs 缺少官方 GitHub');
      }
      const lang = p.expectedLang;
      if (!descriptions.has(lang)) descriptions.set(lang, new Map());
      const byDescription = descriptions.get(lang);
      byDescription.set(org.description, [...(byDescription.get(org.description) || []), p.rel]);
    } catch (error) {
      issues.push(p.rel + ' — JSON-LD 無法解析：' + error.message);
    }
  }
  for (const [lang, variants] of descriptions) {
    if (variants.size !== 1) {
      issues.push(lang + ' — 三頁 Organization description 不一致：'
        + [...variants.values()].map((files) => files.join(', ')).join(' / '));
    }
  }
  const inceptionRules = [
    ['about/index.html', /<dt>Since<\/dt><dd>2026<\/dd>/],
    ['zh/about/index.html', /<dt>起步於<\/dt><dd>2026<\/dd>/],
    ['ja/about/index.html', /<dt>活動開始<\/dt><dd>2026<\/dd>/],
  ];
  for (const [rel, pattern] of inceptionRules) {
    const page = pages.find((p) => p.rel === rel);
    if (!page || !pattern.test(page.html)) issues.push(rel + ' — 對外起始年份用字不符 facts 決議');
  }
  if (issues.length === 0) pass('三語承諾用字、活動起始年份與 Organization JSON-LD 一致');
  else for (const issue of issues) fail(issue);
}

// ---------- 8. Metadata／互動安全／明示語言 URL ----------
console.log('');
console.log('=== 8. Metadata、互動安全與明示語言 URL 回歸 ===');
{
  const issues = [];
  const langLabel = { en: 'Language', 'zh-Hant': '語言', ja: '言語' };

  for (const p of pages) {
    const titles = [...p.html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
    if (titles.length !== 1 || !decodeEntities(titles[0]?.[1] || '').trim()) {
      issues.push(p.rel + ' — title 必須恰有一個且不可為空');
    }

    const meta = [...p.html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrsOfTag(m[0]));
    function metaValues(kind, key) {
      return meta.filter((a) => (a[kind] || '').toLowerCase() === key).map((a) => a.content || '');
    }
    const descriptions = metaValues('name', 'description');
    if (descriptions.length !== 1 || !descriptions[0].trim()) {
      issues.push(p.rel + ' — meta description 必須恰有一個且不可為空');
    }
    for (const [kind, key] of [
      ['property', 'og:image'], ['property', 'og:image:alt'],
      ['name', 'twitter:image'], ['name', 'twitter:image:alt'],
    ]) {
      const values = metaValues(kind, key);
      if (values.length !== 1 || !values[0].trim()) issues.push(p.rel + ' — 缺少或重複 ' + key);
    }

    const tree = parseHTMLTree(p.html);
    const ids = new Map();
    let switchNode = null;
    walk(tree, (node) => {
      if (node.attrs?.id) ids.set(node.attrs.id, (ids.get(node.attrs.id) || 0) + 1);
      if (hasClass(node, 'lang-switch')) switchNode = node;
      if (node.tag === 'a' && (node.attrs?.target || '').toLowerCase() === '_blank') {
        const rel = (node.attrs.rel || '').toLowerCase().split(/\s+/);
        if (!rel.includes('noopener')) issues.push(p.rel + ' — target="_blank" 外連缺少 rel="noopener"');
      }
    });
    for (const [id, count] of ids) {
      if (count > 1) issues.push(p.rel + ' — 重複 id="' + id + '"（' + count + ' 次）');
    }
    if (!switchNode || switchNode.attrs['aria-label'] !== langLabel[p.expectedLang]) {
      issues.push(p.rel + ' — 語言切換 aria-label 應為「' + langLabel[p.expectedLang] + '」');
    }
    if (switchNode) {
      const switchLinks = [];
      walk(switchNode, (node) => {
        if (node.tag === 'a' && node.attrs?.hreflang) switchLinks.push(node);
      });
      const expectedSwitch = new Map();
      for (const lang of ['en', 'zh-Hant', 'ja']) {
        const alternate = p.alternates.get(lang);
        if (alternate) expectedSwitch.set(lang, new URL(alternate).pathname);
      }
      if (switchLinks.length !== expectedSwitch.size) {
        issues.push(p.rel + ' — 語言切換器必須恰有 en／zh-Hant／ja 三個連結');
      }
      for (const [lang, href] of expectedSwitch) {
        const matches = switchLinks.filter((node) => node.attrs.hreflang === lang);
        if (matches.length !== 1 || decodeEntities(matches[0]?.attrs.href || '') !== href) {
          issues.push(p.rel + ' — 語言切換 ' + lang + ' 必須指向同頁型的 ' + href);
          continue;
        }
        const isCurrent = lang === p.expectedLang;
        const hasCurrent = matches[0].attrs['aria-current'] === 'page';
        if (hasCurrent !== isCurrent || hasClass(matches[0], 'active') !== isCurrent) {
          issues.push(p.rel + ' — 語言切換 ' + lang + ' 的目前頁狀態不一致');
        }
      }
    }

    const inlineScripts = inlineNonJsonScripts(p.html);
    if (inlineScripts.length !== 0) {
      issues.push(p.rel + ' — CSP 僅允許外部 script 與 inline JSON-LD；發現 ' +
        inlineScripts.map((script) => script.type).join('、'));
    }
  }

  // Mutation controls: keep the detector fail-closed for typed executable
  // scripts while continuing to permit the site's JSON-LD data blocks.
  for (const fixture of [
    ['classic', '<script>location.replace("/zh/")<\/script>', 1],
    ['module', '<script type="module">location.replace("/zh/")<\/script>', 1],
    ['JavaScript MIME', '<script type="text/javascript">location.replace("/zh/")<\/script>', 1],
    ['import map', '<script type="importmap">{}</script>', 1],
    ['JSON-LD', '<script type="application/ld+json">{}</script>', 0],
    ['external', '<script type="module" src="/assets/main.js"></script>', 0],
  ]) {
    const actual = inlineNonJsonScripts(fixture[1]).length;
    if (actual !== fixture[2]) issues.push('inline script detector mutation control 失效：' + fixture[0]);
  }

  const runtimeSources = pages.map((p) => [p.rel, p.html]);
  const assetsDir = path.join(ROOT, 'assets');
  for (const name of fs.readdirSync(assetsDir).filter((name) => name.endsWith('.js')).sort()) {
    runtimeSources.push(['assets/' + name, readText(path.join(assetsDir, name))]);
  }
  const legacyLanguageSignals = [
    ['linku_lang', /\blinku_lang\b/],
    ['navigator.languages', /\bnavigator\.languages\b/],
    ['navigator.language', /\bnavigator\.language\b/],
    ['location.replace()', /\blocation\.replace\s*\(/],
  ];
  for (const [rel, source] of runtimeSources) {
    for (const [label, pattern] of legacyLanguageSignals) {
      if (pattern.test(source)) issues.push(rel + ' — 明示語言 URL 不得恢復舊導向訊號：' + label);
    }
  }

  const css = readText(stylesPath);
  const mobileStart = css.search(/@media\s*\(max-width:\s*520px\)/i);
  const mobileCss = mobileStart >= 0 ? css.slice(mobileStart) : '';
  const brandMobile = mobileCss.match(/\.brand\s*\{([^}]*)\}/i)?.[1] || '';
  const langMobile = mobileCss.match(/\.lang-switch\s+a\s*\{([^}]*)\}/i)?.[1] || '';
  if (!/min-height:\s*44px/i.test(brandMobile)) {
    issues.push('styles.css — 520px 窄屏品牌連結缺少 44px 最小高度');
  }
  if (!/min-width:\s*44px/i.test(langMobile) || !/min-height:\s*44px/i.test(langMobile)) {
    issues.push('styles.css — 520px 窄屏語言切換缺少 44×44px 觸控區');
  }

  if (issues.length === 0) pass('九頁 metadata／ID／外連／i18n、語言切換與明示 URL 行為完整');
  else for (const issue of issues) fail(issue);
}

// ---------- 9. 安全標頭／CSP 相容性 ----------
console.log('');
console.log('=== 9. Vercel 安全標頭與嚴格 CSP 相容性 ===');
{
  const issues = [];
  const vercelPath = path.join(ROOT, 'vercel.json');
  const mainPath = path.join(ROOT, 'assets', 'main.js');
  const renderPath = path.join(ROOT, 'assets', 'render.js');
  const proofPath = path.join(ROOT, 'assets', 'proof.js');

  const expectedCsp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'none'",
    "media-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ');
  const expectedHeaders = new Map([
    ['content-security-policy', expectedCsp],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['x-frame-options', 'DENY'],
    ['permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()'],
  ]);

  for (const p of pages) {
    const conflicts = inlineNonJsonScripts(p.html);
    if (conflicts.length) {
      issues.push(p.rel + ' — CSP 無 inline allowance，但頁面含 inline script：' +
        conflicts.map((script) => script.type).join('、'));
    }
  }

  if (!fs.existsSync(vercelPath)) {
    issues.push('缺少 vercel.json，正式站無法取得版本控管的安全標頭');
  } else {
    try {
      const config = JSON.parse(readText(vercelPath));
      const rule = Array.isArray(config.headers)
        ? config.headers.find((entry) => entry && entry.source === '/(.*)')
        : null;
      if (!rule || !Array.isArray(rule.headers)) {
        issues.push('vercel.json — 缺少 source="/(.*)" 的全站 headers 規則');
      } else {
        const actual = new Map(rule.headers.map((header) => [
          String(header?.key || '').toLowerCase(), String(header?.value || ''),
        ]));
        for (const [key, value] of expectedHeaders) {
          if (actual.get(key) !== value) issues.push('vercel.json — ' + key + ' 與受測安全政策不一致');
        }
      }
    } catch (error) {
      issues.push('vercel.json — JSON 無法解析：' + error.message);
    }
  }

  const main = readText(mainPath);
  const render = readText(renderPath);
  const proof = readText(proofPath);
  const css = readText(stylesPath);
  if (/speculationrules/i.test(main)) issues.push('assets/main.js — 嚴格 CSP 下不得動態注入 speculation rules');
  if (/style\.cssText/.test(render) || /style\.cssText/.test(proof)) {
    issues.push('render.js／proof.js — #still 路徑不得依賴 style.cssText');
  }
  if (!/\.proof-still-image\s*\{/.test(css)) {
    issues.push('styles.css — 缺少 proof CSP-safe snapshot class');
  }

  if (issues.length === 0) pass('安全標頭、無 inline script 的 CSP、資源來源與 CSP-safe 快照路徑一致');
  else for (const issue of issues) fail(issue);
}

// ---------- 10. Render runtime 治理與動畫控制語意 ----------
console.log('');
console.log('=== 10. Render runtime 治理與動畫控制語意 ===');
{
  const issues = [];
  const render = readText(path.join(ROOT, 'assets', 'render.js'));
  const proof = readText(path.join(ROOT, 'assets', 'proof.js'));

  if (!/MODE\s*=\s*INNER\s*\?\s*['"]direct['"]\s*:\s*['"]pipe['"]/.test(render)) {
    issues.push('assets/render.js — 內頁 WebGL2 未固定走 direct starfield path');
  }
  if (!/if\s*\(HOME\)\s*\{[\s\S]*?mode:\s*['"]blank['"][\s\S]*?\}\s*else\s+if\s*\(reduce\)\s*\{[\s\S]*?staticPoster\(\);[\s\S]*?if\s*\(!STILL\)\s*prebootToggle\(\);/.test(render)) {
    issues.push('assets/render.js — 首頁必須保持無品牌插圖的空白背景；僅內頁 reduced-motion 可使用 poster');
  }
  if (!/introT\s*=\s*Math\.min\(INTRO,\s*introT\s*\+\s*rawDt\)/.test(render)) {
    issues.push('assets/render.js — intro 未使用 unclamped visible elapsed time');
  }
  if (/introT\s*\+=\s*dt/.test(render) || /introT\s*>\s*3/.test(render)) {
    issues.push('assets/render.js — intro 仍依賴 clamped dt 或不可達的治理門檻');
  }
  if (!/var\s+fps\s*=\s*1\s*\/\s*Math\.max\(0\.001,\s*rawDt\)/.test(render)) {
    issues.push('assets/render.js — FPS 治理未量測真實 frame cadence');
  }
  if (/aria-pressed/.test(render) || /aria-pressed/.test(proof)) {
    issues.push('render.js／proof.js — 動態 Play/Pause action label 不得混用 aria-pressed');
  }

  if (issues.length === 0) pass('首頁空白背景、內頁直繪、runtime 治理與 Play/Pause 語意一致');
  else for (const issue of issues) fail(issue);
}

// ---------- 總結 ----------
console.log('');
console.log('=== 總結 ===');
console.log('通過 ' + passCount + ' 項，失敗 ' + failCount + ' 項。');
if (failCount > 0) {
  console.log('存在 FAIL，exit code 1。');
  process.exitCode = 1;
}
