/**
 * Mundaka Surf Academy — admin panel (browser-only CMS, no dependencies).
 *
 * The admin pastes a GitHub fine-grained personal access token (this repository only, Contents: read and write). It is
 * kept in localStorage until "Olvidar token", is only ever sent in the Authorization header to api.github.com, and is
 * never logged or put in a URL.
 *
 * Reading: REST contents API at one commit of the branch. Saving: ONE commit with every changed file (Git Data API:
 * blobs → tree → commit → update ref), so one save is one GitHub Pages deploy. Before committing, the branch head is
 * read again and each file's blob is compared with the one that was loaded: if someone changed it meanwhile, the save
 * stops, that file is reloaded and nothing is overwritten.
 *
 * Files are patched in place (patchJSON): only the values that changed are rewritten, so formatting, key order and the
 * $comment keys stay as they are. Without a token the panel runs as a read-only preview from the site's own /data
 * files. Pure helpers are exported for _tools/test-admin.mjs.
 */

// ================================================================ settings

/** Responsive widths written for every uploaded photo (only those ≤ the source width; never upscaled). */
export const WIDTHS = [480, 800, 1200, 1600];
export const WEBP_QUALITY = 0.82;
const TOKEN_KEY = 'msa-admin-token';
const TAB_KEY = 'msa-admin-tab';
const API = 'https://api.github.com';
const FILES = {
  plans: 'public/data/plans.json',
  team: 'public/data/team.json',
  gallery: 'public/data/gallery.json',
  config: 'site.config.json',
  es: 'src/locales/es.json',
  en: 'src/locales/en.json',
};
const IMG_DIR = 'public/assets/img';
const VIDEO_DIR = 'public/assets/video';
/** Read-only preview: what the site itself serves (site.config.json and the locales are not published). */
const PREVIEW_FILES = { plans: '../data/plans.json', team: '../data/team.json', gallery: '../data/gallery.json' };
const PREVIEW_PAGES = ['../gallery.html', '../team.html'];

export const REPO = detectRepo(globalThis.location);
const PAGES_URL = `https://${REPO.owner}.github.io/${REPO.repo}/`;

/** owner/repo from a <owner>.github.io/<repo>/ address; this repository otherwise (localhost, custom domain). */
export function detectRepo(loc) {
  const fallback = { owner: 'gireeshkumarreddy', repo: 'mundaka-surf-academy', branch: 'main' };
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(loc?.hostname ?? '');
  const first = (loc?.pathname ?? '').split('/').filter(Boolean)[0];
  return m && first && first !== 'admin' ? { owner: m[1], repo: first, branch: 'main' } : fallback;
}

// ================================================================ pure helpers (unit-tested)

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  const s = atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
/** UTF-8 safe (btoa/atob alone break on "ñ", "€", "¡"…). */
export const utf8ToBase64 = (str) => bytesToBase64(new TextEncoder().encode(str));
export const base64ToUtf8 = (b64) => new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(b64));

/** File-name safe slug: "Foto Ñandú 2.JPG" → "foto-nandu-2-jpg". */
export function slugify(s, fallback = 'foto') {
  const slug = String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || fallback;
}

/** `base`, or `base-2`, `base-3`… — the first that is not in `taken` (Set, Map or array). */
export function uniqueName(base, taken) {
  const has = (n) => (Array.isArray(taken) ? taken.includes(n) : taken.has(n));
  if (!has(base)) return base;
  for (let i = 2; ; i++) if (!has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Widths to write for a source image: the standard ones that fit, or the source width itself if it is smaller. */
export function pickWidths(sourceWidth, widths = WIDTHS) {
  const w = Math.floor(sourceWidth);
  if (!(w > 0)) return [];
  const fit = widths.filter((x) => x <= w);
  return fit.length ? fit : [w];
}

/** Crop rectangle for an aspect ratio (width / height): centred horizontally, upper third kept for portraits. */
export function cropRect(w, h, ratio) {
  if (!ratio || Math.abs(w / h - ratio) < 0.005) return { x: 0, y: 0, w, h };
  if (w / h > ratio) {
    const cw = Math.round(h * ratio);
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h };
  }
  const ch = Math.round(w / ratio);
  return { x: 0, y: Math.round((h - ch) * 0.3), w, h: ch };
}

/** name → sorted widths, from file names like "green-curl-800.webp" (the same rule as scripts/build.mjs). */
export function imageManifest(fileNames) {
  const out = new Map();
  for (const f of fileNames) {
    const m = /^(.+)-(\d+)\.webp$/.exec(f);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], []);
    out.get(m[1]).push(Number(m[2]));
  }
  for (const w of out.values()) w.sort((a, b) => a - b);
  return out;
}
/** Width to use for a small preview. */
export const thumbWidth = (widths) => widths.find((w) => w >= 400) ?? widths[widths.length - 1];

/**
 * JSON parser that keeps positions and key order: { type: 'object', start, end, entries: [{ key, node }] },
 * { type: 'array', start, end, items }, { type: 'scalar', start, end, value }.
 */
export function parseJSON(text) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const fail = (msg) => {
    throw new SyntaxError(`${msg} (posición ${i})`);
  };
  const ws = () => {
    while (i < text.length && (text[i] === ' ' || text[i] === '\n' || text[i] === '\r' || text[i] === '\t')) i++;
  };
  const str = () => {
    const s = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    if (i >= text.length) fail('Texto sin cerrar');
    i++;
    return JSON.parse(text.slice(s, i));
  };
  const literal = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
  const value = () => {
    ws();
    const start = i;
    const c = text[i];
    if (c === '{') {
      i++;
      const entries = [];
      ws();
      if (text[i] === '}') return { type: 'object', start, end: ++i, entries };
      for (;;) {
        ws();
        if (text[i] !== '"') fail('Se esperaba una clave');
        const key = str();
        ws();
        if (text[i] !== ':') fail('Se esperaba «:»');
        i++;
        entries.push({ key, node: value() });
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === '}') return { type: 'object', start, end: ++i, entries };
        else fail('Se esperaba «,» o «}»');
      }
    }
    if (c === '[') {
      i++;
      const items = [];
      ws();
      if (text[i] === ']') return { type: 'array', start, end: ++i, items };
      for (;;) {
        items.push(value());
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === ']') return { type: 'array', start, end: ++i, items };
        else fail('Se esperaba «,» o «]»');
      }
    }
    if (c === '"') {
      const v = str();
      return { type: 'scalar', start, end: i, value: v };
    }
    literal.lastIndex = i;
    const m = literal.exec(text);
    if (!m) fail('Valor no válido');
    i += m[0].length;
    return { type: 'scalar', start, end: i, value: JSON.parse(m[0]) };
  };
  const root = value();
  ws();
  if (i !== text.length) fail('Contenido de más al final');
  return root;
}

export function nodeValue(node) {
  if (node.type === 'object') return Object.fromEntries(node.entries.map((e) => [e.key, nodeValue(e.node)]));
  if (node.type === 'array') return node.items.map(nodeValue);
  return node.value;
}

const isObj = (v) => v instanceof Map || (v !== null && typeof v === 'object' && !Array.isArray(v));
const entriesOf = (v) => (v instanceof Map ? [...v.entries()] : Object.entries(v)).filter(([, x]) => x !== undefined);

/** JSON.stringify(v, null, unit) that also takes Maps (ordered objects); `base` indents every line after the first. */
export function stringifyJSON(v, unit = '  ', base = '') {
  const inner = base + unit;
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x) => inner + stringifyJSON(x, unit, inner)).join(',\n')}\n${base}]`;
  }
  if (isObj(v)) {
    const e = entriesOf(v);
    if (!e.length) return '{}';
    return `{\n${e.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${stringifyJSON(x, unit, inner)}`).join(',\n')}\n${base}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Indentation unit of a JSON text (the first indented line), two spaces by default. */
export function detectIndent(text) {
  return /\n([ \t]+)\S/.exec(text)?.[1] ?? '  ';
}

/**
 * Rewrites `text` so it parses to `value`, touching only what changed: changed scalars are replaced where they are;
 * an object whose keys changed, or an array whose length changed, is re-serialised at its own indentation. Key order,
 * formatting and untouched keys (the $comment keys) stay exactly as they were. Ends with a newline.
 */
export function patchJSON(text, value, root = parseJSON(text)) {
  const unit = detectIndent(text);
  const edits = [];
  const indentAt = (pos) => /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', pos - 1) + 1, pos))[0];
  const walk = (node, v) => {
    if (node.type === 'object' && isObj(v)) {
      const e = entriesOf(v);
      if (e.length === node.entries.length && e.every(([k], j) => k === node.entries[j].key)) {
        e.forEach(([, x], j) => walk(node.entries[j].node, x));
        return;
      }
    } else if (node.type === 'array' && Array.isArray(v)) {
      if (v.length === node.items.length) {
        v.forEach((x, j) => walk(node.items[j], x));
        return;
      }
    } else if (node.type === 'scalar' && !isObj(v) && !Array.isArray(v)) {
      const nv = v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? null : v;
      if (node.value !== nv) edits.push([node.start, node.end, JSON.stringify(nv)]);
      return;
    }
    edits.push([node.start, node.end, stringifyJSON(v, unit, indentAt(node.start))]);
  };
  walk(root, value);
  if (!edits.length) return text;
  let out = text;
  for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
  return out.endsWith('\n') ? out : `${out}\n`;
}

/** Locale file → ordered [[path[], value]] leaves (non-empty objects are walked; strings, arrays, {} are leaves). */
export function flattenLocale(src) {
  const root = typeof src === 'string' ? parseJSON(src) : src;
  const out = [];
  const walk = (node, path) => {
    if (node.type === 'object' && node.entries.length) for (const e of node.entries) walk(e.node, [...path, e.key]);
    else out.push([path, nodeValue(node)]);
  };
  walk(root, []);
  return out;
}

/** Inverse of flattenLocale: nested Maps in first-seen order (a new key lands at the end of its parent). */
export function unflattenLocale(entries) {
  const root = new Map();
  for (const [path, value] of entries) {
    if (!path.length) return value;
    let m = root;
    for (const k of path.slice(0, -1)) {
      if (!(m.get(k) instanceof Map)) m.set(k, new Map());
      m = m.get(k);
    }
    m.set(path[path.length - 1], value);
  }
  return root;
}

export const isPrice = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
export const isWhole = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
export const isHours = (n) => typeof n === 'number' && n > 0 && n <= 24 && Number.isInteger(n * 2);
export const isTotalHours = (n) => typeof n === 'number' && n > 0 && n <= 300 && Number.isInteger(n * 2);
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const isHttps = (s) => /^https:\/\/[^\s/]+\.[^\s]+$/.test(s);
export const isWhatsapp = (s) => /^\d{8,15}$/.test(s);
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// ================================================================ state

const S = {
  mode: null, // 'live' (token) | 'preview' (read-only)
  token: null,
  head: null, // last commit seen (for raw.githubusercontent previews)
  files: {}, // key → { path, text, sha, node, orig, data }
  locale: null, // { ids, path: Map, es: Map, en: Map }
  edits: new Map(), // locale id → { es?, en? }
  images: new Map(), // name → widths
  videos: [],
  uploads: new Map(), // name → { name, variants: [{ width, height, blob }], url, committed, small }
  tab: 'precios',
  busy: false,
  dirty: false,
  texts: { q: '', group: '', changed: false, limit: 40 },
};

const SECTIONS = {
  precios: { label: 'Precios / clases', file: 'plans', render: renderPlans },
  instructores: { label: 'Instructores', file: 'team', render: renderTeam },
  galeria: { label: 'Galería', file: 'gallery', render: renderGallery },
  opiniones: { label: 'Opiniones', file: 'config', render: renderReviews },
  ajustes: { label: 'Ajustes / contacto', file: 'config', render: renderSettings },
  textos: { label: 'Textos', file: 'es', render: renderTexts },
};
const CATEGORIES = { lessons: 'Clases', instructors: 'Instructores' };

// ================================================================ DOM helpers

const $ = (sel, root = document) => root.querySelector(sel);
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'multiple', 'htmlFor', 'inert']);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return el;
}
/** replaceChildren without the "null" text nodes that optional (null/false) children would otherwise become. */
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
let uidN = 0;
const uid = () => `f${++uidN}`;
const L = (v) => (v && typeof v === 'object' ? v.es || v.en || '' : v || '');
const getPath = (o, path) => path.reduce((x, k) => (x == null ? undefined : x[k]), o);
function setPath(o, path, v) {
  const parent = path.slice(0, -1).reduce((x, k) => (x[k] && typeof x[k] === 'object' ? x[k] : (x[k] = {})), o);
  parent[path[path.length - 1]] = v;
}
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const store = {
  get(k, area = 'localStorage') {
    try {
      return globalThis[area].getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v, area = 'localStorage') {
    try {
      if (v == null) globalThis[area].removeItem(k);
      else globalThis[area].setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
};

// ================================================================ GitHub API

class GhError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const repoPath = (p) => `/repos/${REPO.owner}/${REPO.repo}${p}`;
const contentsUrl = (path, ref) => repoPath(`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`);

/** One API call. The token only travels in the Authorization header; error messages never contain it. */
async function gh(method, path, body) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${S.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GhError(0, 'No se ha podido contactar con GitHub. Revisa la conexión a internet.');
  }
  if (res.ok) return res.status === 204 ? null : res.json();
  let msg = '';
  try {
    msg = (await res.json()).message || '';
  } catch {}
  throw new GhError(res.status, msg);
}

function explain(e) {
  if (!(e instanceof GhError)) return e?.message || String(e);
  if (e.status === 0) return e.message;
  if (e.status === 401) return 'GitHub no acepta el token: no es válido, ha caducado o se ha revocado.';
  if (e.status === 403 && /rate limit/i.test(e.message)) return 'GitHub ha limitado las peticiones durante un rato. Espera unos minutos y vuelve a intentarlo.';
  if (e.status === 403) return 'El token no tiene permiso para esto. Debe tener acceso a este repositorio con «Contents: Read and write».';
  if (e.status === 404) return `No se encuentra ${REPO.owner}/${REPO.repo}, o el token no tiene acceso a ese repositorio.`;
  if (e.status === 409 || e.status === 422) return `GitHub ha rechazado el cambio (${e.message || e.status}).`;
  return `Error de GitHub (${e.status}${e.message ? `: ${e.message}` : ''}).`;
}

async function headSha() {
  return (await gh('GET', repoPath(`/git/ref/heads/${encodeURIComponent(REPO.branch)}`))).object.sha;
}
/** Every file path → blob sha at a commit (one request; the repository is small). */
async function treeAt(commitSha) {
  const commit = await gh('GET', repoPath(`/git/commits/${commitSha}`));
  const tree = await gh('GET', repoPath(`/git/trees/${commit.tree.sha}?recursive=1`));
  const paths = new Map(tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha]));
  return { treeSha: commit.tree.sha, paths, truncated: Boolean(tree.truncated) };
}
async function fetchFile(path, ref) {
  const j = await gh('GET', contentsUrl(path, ref));
  if (Array.isArray(j) || j.type !== 'file') throw new Error(`${path} no es un archivo.`);
  const b64 = j.content || (await gh('GET', repoPath(`/git/blobs/${j.sha}`))).content; // files over 1 MB come without content
  return { text: base64ToUtf8(b64), sha: j.sha };
}

// ================================================================ loading

function setFile(key, text, sha) {
  let node;
  try {
    node = parseJSON(text);
  } catch (e) {
    throw new Error(`${FILES[key]} no es JSON válido: ${e.message}`);
  }
  S.files[key] = { path: FILES[key], text, sha, node, orig: JSON.parse(text), data: JSON.parse(text) };
}

function buildLocaleIndex() {
  if (!S.files.es || !S.files.en) {
    S.locale = null;
    return;
  }
  const ids = [];
  const path = new Map();
  const vals = { es: new Map(), en: new Map() };
  for (const lang of ['es', 'en']) {
    for (const [p, v] of flattenLocale(S.files[lang].node)) {
      const id = p.join('.');
      if (!path.has(id)) {
        path.set(id, p);
        ids.push(id);
      }
      vals[lang].set(id, v);
    }
  }
  S.locale = { ids, path, es: vals.es, en: vals.en };
}

function resetWork() {
  S.edits.clear();
  for (const u of S.uploads.values()) URL.revokeObjectURL(u.url);
  S.uploads.clear();
}

async function loadLive() {
  const head = await headSha();
  const keys = Object.keys(FILES);
  const [got, tree] = await Promise.all([Promise.all(keys.map((k) => fetchFile(FILES[k], head))), treeAt(head)]);
  const inDir = (dir) => [...tree.paths.keys()].filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/')).map((p) => p.slice(dir.length + 1));
  const files = {};
  const prev = S.files;
  S.files = files;
  try {
    keys.forEach((k, i) => setFile(k, got[i].text, got[i].sha));
  } catch (e) {
    S.files = prev;
    throw e;
  }
  S.head = head;
  S.images = imageManifest(inDir(IMG_DIR));
  S.videos = inDir(VIDEO_DIR).filter((f) => /\.mp4$/i.test(f)).sort();
  resetWork();
  buildLocaleIndex();
}

async function loadPreview() {
  const keys = Object.keys(PREVIEW_FILES);
  const texts = await Promise.all(
    keys.map(async (k) => {
      const r = await fetch(PREVIEW_FILES[k], { cache: 'no-store' });
      if (!r.ok) throw new Error(`No se ha podido leer ${PREVIEW_FILES[k]} (${r.status}).`);
      return r.text();
    }),
  );
  // image widths: read from the published gallery and team pages (the image folder cannot be listed without the API)
  const pages = await Promise.all(PREVIEW_PAGES.map((u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
  S.files = {};
  keys.forEach((k, i) => setFile(k, texts[i], null));
  S.head = null;
  S.images = imageManifest([...pages.join('\n').matchAll(/img\/([A-Za-z0-9_.-]+?-\d+\.webp)/g)].map((m) => m[1]));
  S.videos = [];
  resetWork();
  S.locale = null;
}

// ================================================================ changes, validation

/** New text of a file with the working edits applied (patched in place), or the loaded text if nothing changed. */
function newText(key) {
  const f = S.files[key];
  if (!f) return null;
  if (key === 'es' || key === 'en') {
    const entries = flattenLocale(f.node);
    const at = new Map(entries.map(([p], i) => [p.join('.'), i]));
    let touched = false;
    for (const [id, ed] of S.edits) {
      if (!(key in ed)) continue;
      touched = true;
      if (at.has(id)) entries[at.get(id)] = [entries[at.get(id)][0], ed[key]];
      else entries.push([S.locale.path.get(id), ed[key]]);
    }
    return touched ? patchJSON(f.text, unflattenLocale(entries), f.node) : f.text;
  }
  const out = patchJSON(f.text, f.data, f.node);
  // plans.json carries the date of the last price change
  if (key === 'plans' && out !== f.text && typeof f.data.updated === 'string') return patchJSON(f.text, { ...f.data, updated: today() }, f.node);
  return out;
}

function referencedImages() {
  const refs = new Set();
  for (const p of S.files.team?.data.instructors ?? []) if (p.photo) refs.add(p.photo);
  for (const g of S.files.gallery?.data.items ?? []) if (g.image) refs.add(g.image);
  return refs;
}

function pendingChanges() {
  const files = [];
  for (const key of Object.keys(S.files)) {
    const text = newText(key);
    if (text != null && text !== S.files[key].text) files.push({ key, path: S.files[key].path, text });
  }
  const refs = referencedImages();
  const images = [...S.uploads.values()].filter((u) => !u.committed && refs.has(u.name));
  return { files, images };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function dirtySections(ch) {
  const out = new Set();
  for (const f of ch.files) {
    if (f.key === 'plans') out.add('precios');
    else if (f.key === 'team') out.add('instructores');
    else if (f.key === 'gallery') out.add('galeria');
    else if (f.key === 'es' || f.key === 'en') out.add('textos');
    else if (f.key === 'config') {
      const { data, orig } = S.files.config;
      if (!same(data.reviews, orig.reviews)) out.add('opiniones');
      if (!same({ ...data, reviews: null }, { ...orig, reviews: null })) out.add('ajustes');
    }
  }
  for (const u of ch.images) {
    if ((S.files.team?.data.instructors ?? []).some((p) => p.photo === u.name)) out.add('instructores');
    if ((S.files.gallery?.data.items ?? []).some((g) => g.image === u.name)) out.add('galeria');
  }
  return out;
}

/** Everything that would break the site or the build, as [{ tab, msg }]. */
function validate() {
  const errs = [];
  const add = (tab, msg) => errs.push({ tab, msg });
  const live = S.mode === 'live';
  const known = (name) => S.images.has(name) || S.uploads.has(name);

  for (const p of S.files.plans?.data.plans ?? []) {
    const label = L(p.name) || p.id;
    if (!p.name?.es?.trim()) add('precios', `${label}: falta el nombre en español.`);
    const pr = p.price ?? {};
    if (pr.unit === 'personHour') {
      if (!isPrice(pr.amount)) add('precios', `${label}: el precio por hora no es válido (número mayor que 0, hasta 2 decimales).`);
      if (!Array.isArray(pr.hours) || !pr.hours.length) add('precios', `${label}: añade al menos una duración.`);
      else if (!pr.hours.every(isHours)) add('precios', `${label}: cada duración debe ser un número de horas (entero o media hora, p. ej. 1.5).`);
      else if (new Set(pr.hours).size !== pr.hours.length) add('precios', `${label}: hay duraciones repetidas.`);
    } else if (pr.unit === 'package') {
      const ks = Array.isArray(pr.packages) ? pr.packages : [];
      if (!ks.length) add('precios', `${label}: añade al menos un paquete.`);
      ks.forEach((k, i) => {
        if (!isWhole(k.days, 60)) add('precios', `${label}, paquete ${i + 1}: los días deben ser un número entero.`);
        if (!isTotalHours(k.hours)) add('precios', `${label}, paquete ${i + 1}: las horas no son válidas (entero o media hora).`);
        if (!isPrice(k.amount)) add('precios', `${label}, paquete ${i + 1}: el precio no es válido.`);
      });
      if (new Set(ks.map((k) => k.days)).size !== ks.length) add('precios', `${label}: hay dos paquetes con los mismos días.`);
    }
  }

  const team = S.files.team?.data.instructors ?? [];
  const ids = new Set();
  const photos = new Map();
  team.forEach((p, i) => {
    const label = L(p.name) || `Instructor ${i + 1}`;
    if (!p.name?.es?.trim()) add('instructores', `Ficha ${i + 1}: falta el nombre.`);
    if (ids.has(p.id)) add('instructores', `${label}: identificador repetido (${p.id}).`);
    ids.add(p.id);
    if (p.photo) {
      if (photos.has(p.photo)) add('instructores', `${label} y ${photos.get(p.photo)} usan la misma foto. Cada instructor debe tener una foto distinta.`);
      else photos.set(p.photo, label);
      if (live && !known(p.photo)) add('instructores', `${label}: la foto «${p.photo}» no existe en ${IMG_DIR}.`);
    }
    (p.certificates ?? []).forEach((c, j) => {
      if (!L(c).trim()) add('instructores', `${label}: el certificado ${j + 1} está vacío.`);
    });
  });

  (S.files.gallery?.data.items ?? []).forEach((g, i) => {
    if (!g.image) add('galeria', `Foto ${i + 1}: falta la imagen.`);
    else if (live && !known(g.image)) add('galeria', `Foto ${i + 1}: la imagen «${g.image}» no existe en ${IMG_DIR}.`);
    if (!CATEGORIES[g.category]) add('galeria', `Foto ${i + 1}: elige una categoría.`);
    if (!g.alt?.es?.trim()) add('galeria', `Foto ${i + 1}: falta la descripción en español (la leen los buscadores y los lectores de pantalla).`);
  });

  const cfg = S.files.config?.data;
  if (cfg) {
    const rv = cfg.reviews ?? {};
    if (rv.googleUrl && !isHttps(rv.googleUrl)) add('opiniones', 'El enlace a las opiniones de Google debe empezar por https://');
    (rv.items ?? []).forEach((r, i) => {
      const label = r.name?.trim() || `Opinión ${i + 1}`;
      if (!r.name?.trim()) add('opiniones', `Opinión ${i + 1}: falta el nombre.`);
      if (!isDate(r.date ?? '')) add('opiniones', `${label}: la fecha no es válida (AAAA-MM-DD).`);
      if (!isWhole(r.rating, 5)) add('opiniones', `${label}: la valoración debe ser de 1 a 5 estrellas.`);
      if (!L(r.text?.es ?? r.text).trim()) add('opiniones', `${label}: falta el texto en español.`);
    });
    const email = cfg.contact?.email ?? '';
    if (email && !isEmail(email)) add('ajustes', 'El email de contacto no es válido.');
    const wa = cfg.whatsapp?.number ?? '';
    if (wa && !isWhatsapp(wa)) add('ajustes', 'El número de WhatsApp debe tener solo dígitos, con el prefijo del país (8 a 15 cifras, sin + ni espacios).');
    for (const net of ['instagram', 'facebook']) {
      const url = cfg.social?.[net]?.url ?? '';
      if (url && !isHttps(url)) add('ajustes', `El enlace de ${net === 'instagram' ? 'Instagram' : 'Facebook'} debe empezar por https://`);
    }
    if (cfg.siteUrl && !isHttps(cfg.siteUrl)) add('ajustes', 'La dirección de la web debe empezar por https:// (o quedarse vacía).');
    const video = cfg.hero?.video ?? '';
    if (video && live && !S.videos.includes(video)) add('ajustes', `El vídeo «${video}» no está en ${VIDEO_DIR}.`);
    if (typeof cfg.reviewMode !== 'boolean') add('ajustes', 'El modo revisión debe estar activado o desactivado.');
  }
  return errs;
}

// ================================================================ saving

async function save() {
  if (S.busy || S.mode !== 'live') return;
  const errs = validate();
  if (errs.length) {
    showErrors(errs);
    return;
  }
  if (!S.dirty) return;
  setBusy(true, 'Guardando…');
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await commitChanges();
        break;
      } catch (e) {
        // someone pushed between our check and the ref update: check again from the new head
        if (e.code === 'race' && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    notify('error', h('p', {}, h('strong', {}, 'No se ha guardado. '), explain(e)));
  } finally {
    setBusy(false);
    refreshStatus();
  }
}

async function commitChanges() {
  progress('Comprobando la última versión en GitHub…');
  const latest = await headSha();
  const tree = await treeAt(latest);
  let ch = pendingChanges();

  // 1. a file changed since it was loaded? → stop, reload it, overwrite nothing
  const conflicts = [];
  for (const f of ch.files) {
    let sha = tree.paths.get(f.path);
    if (tree.truncated && !sha) sha = (await gh('GET', contentsUrl(f.path, latest)).catch(() => null))?.sha;
    if (sha !== S.files[f.key].sha) conflicts.push(f.key);
  }
  if (conflicts.length) {
    await reloadConflicts(conflicts, latest);
    return;
  }

  // 2. a new photo name taken meanwhile? → rename it before writing
  const taken = new Set([...imageManifest([...tree.paths.keys()].filter((p) => p.startsWith(`${IMG_DIR}/`)).map((p) => p.slice(IMG_DIR.length + 1))).keys()]);
  let renamed = false;
  for (const u of ch.images) {
    if (!taken.has(u.name)) continue;
    renameUpload(u, uniqueName(u.name, new Set([...taken, ...S.images.keys(), ...S.uploads.keys()])));
    renamed = true;
  }
  if (renamed) ch = pendingChanges();

  // 3. blobs → tree → commit → ref
  const writes = [
    ...ch.files.map((f) => ({ path: f.path, b64: () => utf8ToBase64(f.text) })),
    ...ch.images.flatMap((u) => u.variants.map((v) => ({ path: `${IMG_DIR}/${u.name}-${v.width}.webp`, b64: async () => bytesToBase64(new Uint8Array(await v.blob.arrayBuffer())) }))),
  ];
  const shas = new Map();
  const total = writes.length;
  const worker = async () => {
    for (let w = writes.shift(); w; w = writes.shift()) {
      const blob = await gh('POST', repoPath('/git/blobs'), { content: await w.b64(), encoding: 'base64' });
      shas.set(w.path, blob.sha);
      progress(`Subiendo archivos a GitHub… ${shas.size} de ${total}`);
    }
  };
  progress(`Subiendo ${plural(total, 'archivo', 'archivos')} a GitHub…`);
  await Promise.all([worker(), worker(), worker()]);
  progress('Creando el cambio en GitHub…');
  const newTree = await gh('POST', repoPath('/git/trees'), {
    base_tree: tree.treeSha,
    tree: [...shas].map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })),
  });
  const commit = await gh('POST', repoPath('/git/commits'), { message: commitMessage(ch), tree: newTree.sha, parents: [latest] });
  try {
    await gh('PATCH', repoPath(`/git/refs/heads/${encodeURIComponent(REPO.branch)}`), { sha: commit.sha, force: false });
  } catch (e) {
    if (e.status === 422 || e.status === 409) throw Object.assign(new Error('race'), { code: 'race' });
    throw e;
  }

  // 4. what was saved is now the loaded version
  const sections = [...dirtySections(ch)];
  for (const f of ch.files) setFile(f.key, f.text, shas.get(f.path));
  if (ch.files.some((f) => f.key === 'es' || f.key === 'en')) {
    S.edits.clear();
    buildLocaleIndex();
  }
  for (const u of ch.images) {
    u.committed = true;
    S.images.set(u.name, u.variants.map((v) => v.width));
  }
  S.head = commit.sha;
  const live = (S.files.config?.data.siteUrl || '').trim() || PAGES_URL;
  const repoUrl = `https://github.com/${REPO.owner}/${REPO.repo}`;
  notify(
    'ok',
    h('p', {}, h('strong', {}, 'Guardado. '), `Se ha creado un cambio en GitHub (${sections.map((s) => SECTIONS[s].label).join(', ')}). La web se reconstruye y se publica sola en 1–2 minutos.`),
    h(
      'p',
      { class: 'notice__links' },
      h('a', { href: `${repoUrl}/actions`, target: '_blank', rel: 'noopener' }, 'Ver la publicación en GitHub Actions'),
      h('a', { href: live, target: '_blank', rel: 'noopener' }, 'Abrir la web'),
      h('a', { href: `${repoUrl}/commit/${commit.sha}`, target: '_blank', rel: 'noopener' }, `Ver el cambio (${commit.sha.slice(0, 7)})`),
    ),
  );
  renderPanel();
}

function commitMessage(ch) {
  const sections = [...dirtySections(ch)].map((s) => SECTIONS[s].label.toLowerCase());
  const photos = ch.images.length ? ` (${plural(ch.images.length, 'foto nueva', 'fotos nuevas')})` : '';
  const lines = [...ch.files.map((f) => f.path), ...ch.images.map((u) => `${IMG_DIR}/${u.name}-{${u.variants.map((v) => v.width).join(',')}}.webp`)];
  return `Admin: ${sections.join(', ')}${photos}\n\nGuardado desde el panel /admin/.\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

async function reloadConflicts(keys, latest) {
  const all = new Set(keys);
  if (all.has('es') || all.has('en')) all.add('es').add('en');
  progress('Cargando la versión nueva…');
  const got = await Promise.all([...all].map(async (k) => [k, await fetchFile(FILES[k], latest)]));
  for (const [k, f] of got) setFile(k, f.text, f.sha);
  if (all.has('es')) {
    S.edits.clear();
    buildLocaleIndex();
  }
  S.head = latest;
  const names = [...all].map((k) => FILES[k]);
  notify(
    'warn',
    h('p', {}, h('strong', {}, 'No se ha guardado nada. '), `Alguien ha cambiado ${names.length > 1 ? 'estos archivos' : 'este archivo'} en GitHub desde que abriste el panel:`),
    h('ul', {}, names.map((n) => h('li', {}, h('code', {}, n)))),
    h('p', {}, 'Se ha cargado la versión nueva y se han descartado tus cambios en esos archivos para no borrar los del otro cambio. Revísalos y vuelve a guardar. El resto de tus cambios sigue pendiente.'),
  );
  renderPanel();
}

// ================================================================ images

let webpSupport = null;
function canEncodeWebp() {
  if (webpSupport == null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { img: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`«${file.name}» no se puede abrir como imagen en este navegador. Usa una foto JPG, PNG o WebP.`);
  }
  return { img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** Draws the crop of `source` at w×h: high-quality resize, or halving steps where that is not supported. */
async function drawResized(source, crop, w, hgt) {
  const canvas = h('canvas', { width: w, height: hgt });
  const ctx = canvas.getContext('2d');
  let bmp = null;
  try {
    bmp = await createImageBitmap(source, crop.x, crop.y, crop.w, crop.h, { resizeWidth: w, resizeHeight: hgt, resizeQuality: 'high' });
  } catch {}
  if (bmp && bmp.width === w && bmp.height === hgt) {
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    return canvas;
  }
  bmp?.close();
  let cur = source;
  let { x: sx, y: sy, w: sw, h: sh } = crop;
  while (sw / 2 >= w) {
    const step = h('canvas', { width: Math.round(sw / 2), height: Math.round(sh / 2) });
    const sctx = step.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(cur, sx, sy, sw, sh, 0, 0, step.width, step.height);
    [cur, sx, sy, sw, sh] = [step, 0, 0, step.width, step.height];
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, sx, sy, sw, sh, 0, 0, w, hgt);
  return canvas;
}

/** A photo → WebP variants at WIDTHS (≤ source), quality 0.82, optionally cropped to `ratio` first. */
async function makeVariants(file, ratio) {
  if (!canEncodeWebp()) throw new Error('Este navegador no puede crear imágenes WebP. Sube las fotos desde Chrome, Edge o Firefox en un ordenador o en un móvil Android.');
  const src = await decodeImage(file);
  try {
    const crop = cropRect(src.width, src.height, ratio);
    const variants = [];
    for (const w of pickWidths(crop.w)) {
      const hgt = Math.max(1, Math.round((w * crop.h) / crop.w));
      const canvas = await drawResized(src.img, crop, w, hgt);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
      if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador no ha podido convertir la foto a WebP. Prueba con Chrome, Edge o Firefox.');
      variants.push({ width: w, height: hgt, blob });
    }
    return { variants, small: crop.w < WIDTHS[1] };
  } finally {
    src.close();
  }
}

function takenNames() {
  return new Set([...S.images.keys(), ...S.uploads.keys(), ...referencedImages(), ...(S.files.plans?.data.plans ?? []).map((p) => p.image).filter(Boolean)]);
}

/** Resizes the chosen files and keeps them as pending uploads; returns the new image names. */
async function processFiles(files, { ratio = null, base, status }) {
  const names = [];
  const say = (msg, cls = '') => {
    if (status) {
      status.textContent = msg;
      status.className = `picker__status ${cls}`;
    }
  };
  for (const [i, file] of files.entries()) {
    say(`Preparando ${files.length > 1 ? `${i + 1} de ${files.length}: ` : ''}${file.name}…`);
    try {
      const { variants, small } = await makeVariants(file, ratio);
      const name = uniqueName(slugify(base(file)), takenNames());
      S.uploads.set(name, { name, variants, url: URL.createObjectURL(variants[0].blob), committed: false, small });
      names.push(name);
    } catch (e) {
      say(e.message, 'error');
      return names;
    }
  }
  const small = names.filter((n) => S.uploads.get(n).small);
  say(small.length ? `Lista. Ojo: ${small.join(', ')} es pequeña (menos de ${WIDTHS[1]} px de ancho) y puede verse borrosa.` : '');
  return names;
}

function renameUpload(u, name) {
  const old = u.name;
  S.uploads.delete(old);
  u.name = name;
  S.uploads.set(name, u);
  for (const p of S.files.team?.data.instructors ?? []) if (p.photo === old) p.photo = name;
  for (const g of S.files.gallery?.data.items ?? []) if (g.image === old) g.image = name;
}

const isPhotoName = (n) => !/^(brush|texture|logo|badge|level)(-|$)|-(fg|m)$/.test(n);

function thumbSources(name) {
  if (!name) return [];
  const up = S.uploads.get(name);
  if (up) return [up.url];
  const widths = S.images.get(name);
  if (!widths?.length) return [];
  const file = encodeURIComponent(`${name}-${thumbWidth(widths)}.webp`);
  const out = [`../assets/img/${file}`];
  // not on the published site yet (saved a moment ago): straight from the repository
  if (S.mode === 'live') out.push(`https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${S.head || REPO.branch}/${IMG_DIR}/${file}`);
  return out;
}

function thumb(name, { portrait = false } = {}) {
  const box = h('span', { class: `thumb${portrait ? ' thumb--portrait' : ''}` });
  const src = thumbSources(name);
  const placeholder = () => h('span', { class: 'thumb__ph' }, name ? 'Sin vista previa' : 'Sin foto');
  if (!src.length) box.append(placeholder());
  else {
    let i = 0;
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => {
      if (++i < src.length) img.src = src[i];
      else img.replaceWith(placeholder());
    });
    img.src = src[0];
    box.append(img);
  }
  if (S.uploads.has(name) && !S.uploads.get(name).committed) box.append(h('span', { class: 'thumb__tag' }, 'Nueva, sin guardar'));
  return box;
}

/** Dialog: upload new photos or pick one that already exists. `used`: name → label (disabled), `marks`: name → note. */
function openPicker({ title, used = new Map(), marks = new Map(), ratio = null, ratioLabel = '', multiple = false, base, onPick }) {
  const dlg = $('#picker');
  const status = h('p', { class: 'picker__status', role: 'status' });
  const input = h('input', { type: 'file', accept: 'image/*', multiple, hidden: true, 'data-upload': 'picker' });
  const crop = ratio ? h('input', { type: 'checkbox', checked: true }) : null;
  const finish = (names) => {
    if (!names.length) return;
    dlg.close();
    onPick(names);
  };
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    if (!files.length) return;
    finish(await processFiles(files, { ratio: crop?.checked ? ratio : null, base, status }));
  });
  const names = [...new Set([...S.uploads.keys(), ...[...S.images.keys()].filter(isPhotoName).sort()])];
  const grid = h(
    'div',
    { class: 'picker__grid' },
    names.map((n) => {
      const usedBy = used.get(n);
      return h(
        'button',
        { type: 'button', class: 'pick', disabled: Boolean(usedBy), title: n, 'data-name': n, onclick: () => finish([n]) },
        thumb(n, { portrait: Boolean(ratio) }),
        h('span', { class: 'pick__name' }, n),
        usedBy ? h('span', { class: 'pick__note' }, `En uso: ${usedBy}`) : marks.has(n) ? h('span', { class: 'pick__note' }, marks.get(n)) : null,
      );
    }),
  );
  fill(dlg,
    h('div', { class: 'picker__head' }, h('h2', { id: 'picker-title' }, title), h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => dlg.close() }, 'Cerrar')),
    h(
      'div',
      { class: 'picker__body' },
      h(
        'div',
        { class: 'picker__upload' },
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: () => input.click() }, multiple ? 'Subir fotos nuevas' : 'Subir una foto nueva'), input),
        crop ? h('label', { class: 'check' }, crop, ratioLabel) : null,
        h('p', { class: 'hint' }, `Se guardan en WebP a ${WIDTHS.join(', ')} px de ancho (solo los tamaños que caben en la foto original).`),
        status,
      ),
      h('h3', { class: 'subhead' }, names.length ? 'O elige una foto que ya está en la web' : 'No hay más fotos disponibles'),
      grid,
    ),
  );
  dlg.showModal();
}

// ================================================================ UI: chrome

function notify(kind, ...nodes) {
  const n = $('#notice');
  n.className = `notice notice--${kind}`;
  n.setAttribute('role', kind === 'error' || kind === 'warn' ? 'alert' : 'status');
  fill(n, ...nodes);
  n.hidden = false;
  n.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function clearNotice() {
  $('#notice').hidden = true;
}
function showErrors(errs) {
  notify(
    'error',
    h('p', {}, h('strong', {}, 'Revisa esto antes de guardar:')),
    h(
      'ul',
      {},
      errs.map((e) => h('li', {}, h('button', { type: 'button', class: 'btn btn--quiet', onclick: () => selectTab(e.tab) }, SECTIONS[e.tab].label), ': ', e.msg)),
    ),
  );
}
function progress(msg) {
  $('#save-summary').textContent = msg;
}
function setBusy(on, msg) {
  S.busy = on;
  $('#app').inert = on;
  $('#btn-save').disabled = on;
  $('#btn-discard').disabled = on;
  if (on && msg) progress(msg);
}

let statusTimer;
function changed() {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(refreshStatus, 200);
}
function refreshStatus() {
  if (!S.mode || S.busy) return;
  const ch = pendingChanges();
  const dirty = dirtySections(ch);
  S.dirty = ch.files.length > 0 || ch.images.length > 0;
  for (const b of document.querySelectorAll('.tab')) b.classList.toggle('is-dirty', dirty.has(b.dataset.tab));
  const summary = $('#save-summary');
  const what = [...dirty].map((s) => SECTIONS[s].label).join(', ');
  const photos = ch.images.length ? ` · ${plural(ch.images.length, 'foto nueva', 'fotos nuevas')}` : '';
  if (S.mode === 'preview') {
    fill(summary, h('strong', {}, 'Vista previa: '), S.dirty ? `has cambiado ${what}${photos}, pero sin token no se guarda nada.` : 'puedes probar el panel, pero sin token no se guarda nada.');
  } else if (S.dirty) {
    fill(summary, h('strong', {}, 'Cambios sin guardar: '), `${what}${photos}.`);
  } else summary.textContent = 'No hay cambios pendientes.';
  $('#savebar').classList.toggle('is-dirty', S.dirty);
  $('#btn-save').disabled = S.mode !== 'live' || !S.dirty;
  $('#btn-save').textContent = S.mode === 'live' ? 'Guardar cambios' : 'Guardar';
  $('#btn-discard').disabled = !S.dirty && ![...S.uploads.values()].some((u) => !u.committed);
}

function renderStatus() {
  const box = $('#status');
  if (!S.mode) {
    fill(box, h('a', { href: '../' }, 'Ver la web'));
    return;
  }
  const live = S.mode === 'live';
  fill(box,
    live ? h('span', { class: 'pill' }, 'Conectado') : h('span', { class: 'pill pill--preview' }, 'Vista previa · solo lectura'),
    live ? h('span', { class: 'mono' }, `${REPO.owner}/${REPO.repo} · ${REPO.branch}`) : null,
    h('a', { href: '../' }, 'Ver la web'),
    h('button', { type: 'button', class: 'btn', onclick: reload }, 'Recargar'),
    live ? h('button', { type: 'button', class: 'btn', id: 'btn-forget', onclick: forgetToken }, 'Olvidar token') : h('button', { type: 'button', class: 'btn', onclick: showConnect }, 'Conectar'),
  );
}

function selectTab(id) {
  if (!SECTIONS[id]) id = 'precios';
  S.tab = id;
  store.set(TAB_KEY, id, 'sessionStorage');
  for (const b of document.querySelectorAll('.tab')) {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== `panel-${id}`;
  renderPanel();
}

function renderPanel(focus) {
  if (!S.mode) return;
  const panel = $(`#panel-${S.tab}`);
  const sec = SECTIONS[S.tab];
  if (!S.files[sec.file]) needsConnect(panel, sec.label);
  else sec.render(panel);
  if (focus) requestAnimationFrame(() => (panel.querySelector(focus[0]) ?? (focus[1] && panel.querySelector(focus[1])))?.focus());
  refreshStatus();
}
const rerender = (...focus) => renderPanel(focus.length ? focus : null);

function showApp() {
  $('#connect').hidden = true;
  $('#app').hidden = false;
  $('#savebar').hidden = false;
  clearNotice();
  renderStatus();
  selectTab(store.get(TAB_KEY, 'sessionStorage') || S.tab);
}

function showConnect(message) {
  if (S.mode === 'preview' && S.dirty && !confirm('Los cambios de la vista previa se perderán. ¿Continuar?')) return;
  S.mode = null;
  $('#app').hidden = true;
  $('#savebar').hidden = true;
  $('#connect').hidden = false;
  const err = $('#connect-error');
  err.textContent = typeof message === 'string' ? message : '';
  err.hidden = typeof message !== 'string';
  $('#btn-forget-stored').hidden = !store.get(TOKEN_KEY);
  renderStatus();
  if (typeof message === 'string' || matchMedia('(pointer: fine)').matches) $('#token').focus();
}

async function connect(token) {
  const btn = $('#btn-connect');
  btn.disabled = true;
  btn.textContent = 'Conectando…';
  S.token = token;
  try {
    await loadLive();
    S.mode = 'live';
    $('#token').value = '';
    showApp();
    if (!store.set(TOKEN_KEY, token)) notify('warn', h('p', {}, 'Este navegador no permite guardar el token: tendrás que pegarlo otra vez la próxima vez.'));
  } catch (e) {
    S.token = null;
    showConnect(explain(e));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Conectar';
  }
}

async function startPreview() {
  const btn = $('#btn-preview');
  btn.disabled = true;
  try {
    await loadPreview();
    S.mode = 'preview';
    S.token = null;
    showApp();
  } catch (e) {
    showConnect(e.message);
  } finally {
    btn.disabled = false;
  }
}

async function reload() {
  if (S.dirty && !confirm('Se perderán los cambios sin guardar. ¿Recargar los datos?')) return;
  setBusy(true, 'Recargando…');
  try {
    if (S.mode === 'live') await loadLive();
    else await loadPreview();
    clearNotice();
  } catch (e) {
    notify('error', h('p', {}, explain(e)));
  } finally {
    setBusy(false);
    renderPanel();
  }
}

function discard() {
  if (!confirm('¿Descartar todos los cambios sin guardar?')) return;
  for (const f of Object.values(S.files)) f.data = JSON.parse(f.text);
  for (const [n, u] of S.uploads) {
    if (u.committed) continue;
    URL.revokeObjectURL(u.url);
    S.uploads.delete(n);
  }
  S.edits.clear();
  clearNotice();
  renderPanel();
}

function forgetToken() {
  if (S.dirty && !confirm('Hay cambios sin guardar y se perderán. ¿Olvidar el token igualmente?')) return;
  store.set(TOKEN_KEY, null);
  S.token = null;
  S.mode = null;
  S.files = {};
  S.locale = null;
  S.dirty = false;
  resetWork();
  showConnect();
  $('#btn-forget-stored').hidden = true;
}

// ================================================================ UI: building blocks

function intro(title, text, file) {
  return h('div', { class: 'panel__intro' }, h('h2', {}, title), text && h('p', {}, text), file && h('p', { class: 'panel__file mono' }, `Archivo: ${file}`));
}
function needsConnect(panel, title) {
  fill(panel,
    intro(title),
    h(
      'div',
      { class: 'callout' },
      h('p', {}, h('strong', {}, 'Conecta con GitHub para editar esta sección.')),
      h('p', { class: 'hint' }, 'Los ajustes (site.config.json) y los textos (src/locales) no se publican en la web, así que la vista previa no puede leerlos.'),
      h('p', {}, h('button', { type: 'button', class: 'btn', onclick: showConnect }, 'Conectar con un token')),
    ),
  );
}
function card({ title, num, meta, tools, body, cls = '' }) {
  return h(
    'article',
    { class: `card ${cls}` },
    h('header', { class: 'card__head' }, num != null ? h('span', { class: 'card__num' }, String(num).padStart(2, '0')) : null, h('h3', { class: 'card__title' }, title), meta ? h('span', { class: 'card__meta' }, meta) : null, tools?.length ? h('div', { class: 'card__tools' }, tools) : null),
    h('div', { class: 'card__body' }, body),
  );
}
function field(labelText, input, hint) {
  if (!input.id) input.id = uid();
  return h('div', { class: 'field' }, h('label', { for: input.id }, labelText), input, hint ? h('p', { class: 'hint' }, hint) : null);
}
function autoGrow(ta) {
  const fit = () => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  ta.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return ta;
}
function textInput(value, onInput, { multiline = false, type = 'text', rows = 3, ...attrs } = {}) {
  const el = multiline ? autoGrow(h('textarea', { rows, value: value ?? '', ...attrs })) : h('input', { type, value: value ?? '', ...attrs });
  el.addEventListener('input', () => {
    onInput(el.value, el);
    changed();
  });
  return el;
}
/** Number input bound to obj[key]; keeps the typed text when it is not a number, so validation can flag it. */
function numInput(obj, key, { check, label, step = 'any', min = 0, onInput } = {}) {
  const el = h('input', { type: 'number', inputmode: 'decimal', step, min, value: obj[key] ?? '', 'aria-label': label });
  const mark = () => el.setAttribute('aria-invalid', String(!check(obj[key])));
  el.addEventListener('input', () => {
    const raw = el.value.trim();
    const n = raw === '' ? NaN : Number(raw);
    obj[key] = Number.isFinite(n) ? n : raw;
    mark();
    onInput?.();
    changed();
  });
  mark();
  return el;
}
/** Spanish + English inputs for parent[key] = { es, en }. enOptional: an empty English text is removed (falls back to Spanish). */
function bi(parent, key, label, { multiline = false, hint, enOptional = false, onInput, rows } = {}) {
  const cur = parent[key];
  const get = (lang) => (cur && typeof cur === 'object' ? (cur[lang] ?? '') : lang === 'es' ? (cur ?? '') : '');
  const set = (lang, v) => {
    if (!parent[key] || typeof parent[key] !== 'object') parent[key] = { es: typeof parent[key] === 'string' ? parent[key] : '' };
    if (enOptional && lang === 'en' && v === '') delete parent[key].en;
    else parent[key][lang] = v;
    onInput?.(lang, v);
  };
  const one = (lang) => {
    const input = textInput(get(lang), (v) => set(lang, v), { multiline, rows, 'data-lang': lang });
    input.id = uid();
    return h('div', { class: 'bi__lang' }, h('label', { for: input.id }, lang === 'es' ? 'Español' : 'English'), h('span', { class: `lang lang--${lang}`, 'aria-hidden': 'true' }, lang.toUpperCase()), input);
  };
  return h('fieldset', { class: 'bi' }, h('legend', {}, label), h('div', { class: 'bi__grid' }, one('es'), one('en')), hint ? h('p', { class: 'hint' }, hint) : null);
}
function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}
function orderTools(list, i, kind, what) {
  return [
    h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--small', title: 'Subir', 'aria-label': `Subir ${what}`, disabled: i === 0, 'data-focus': `${kind}-up-${i}`, onclick: () => (move(list, i, -1), rerender(`[data-focus="${kind}-up-${i - 1}"]`, `[data-focus="${kind}-down-${i - 1}"]`)) }, '↑'),
    h('button', { type: 'button', class: 'btn btn--ghost btn--icon btn--small', title: 'Bajar', 'aria-label': `Bajar ${what}`, disabled: i === list.length - 1, 'data-focus': `${kind}-down-${i}`, onclick: () => (move(list, i, 1), rerender(`[data-focus="${kind}-down-${i + 1}"]`, `[data-focus="${kind}-up-${i + 1}"]`)) }, '↓'),
    h('button', { type: 'button', class: 'btn btn--danger btn--small', onclick: () => confirm(`¿Eliminar ${what}?`) && (list.splice(i, 1), rerender()) }, 'Eliminar'),
  ];
}
const money = (n) => (isPrice(n) ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)} €` : '—');
function scrollToLast(panel, sel) {
  requestAnimationFrame(() => {
    const all = panel.querySelectorAll(sel);
    const last = all[all.length - 1];
    last?.scrollIntoView({ block: 'center' });
    last?.querySelector('input, textarea')?.focus({ preventScroll: true });
  });
}

// ================================================================ sections

function renderPlans(panel) {
  const data = S.files.plans.data;
  fill(panel,
    intro('Precios / clases', 'Nombres, descripciones y precios por persona. El formulario de reserva, el depósito del 15 % y las tablas de precios de la web usan estos datos.', FILES.plans),
    h('div', { class: 'cards' }, (data.plans ?? []).map(planCard)),
  );
}

function planCard(p) {
  const pr = p.price ?? {};
  const title = h('span', {}, L(p.name) || p.id);
  const body = [bi(p, 'name', 'Nombre', { onInput: (lang) => lang === 'es' && (title.textContent = L(p.name) || p.id) }), bi(p, 'summary', 'Descripción corta', { multiline: true, rows: 2 })];
  if (pr.unit === 'personHour') {
    if (!Array.isArray(pr.hours)) pr.hours = [];
    const calcs = [];
    const refresh = () => calcs.forEach((c) => c());
    body.push(
      h('h4', { class: 'subhead' }, 'Precio'),
      h('div', { class: 'grid-2' }, field('Precio por persona y hora (€)', numInput(pr, 'amount', { check: isPrice, label: 'Precio por persona y hora', step: '0.01', onInput: refresh }), 'Ejemplo: 60')),
      h('h4', { class: 'subhead' }, 'Duraciones que se pueden reservar'),
      h(
        'div',
        {},
        pr.hours.map((v, i) => {
          const calc = h('span', { class: 'calc' });
          const show = () => (calc.textContent = isHours(pr.hours[i]) && isPrice(pr.amount) ? `= ${money(pr.amount * pr.hours[i])} por persona` : '');
          calcs.push(show);
          show();
          return h(
            'div',
            { class: 'line-row line-row--hour' },
            field('Horas', numInput(pr.hours, i, { check: isHours, label: `Duración ${i + 1} en horas`, step: '0.5', onInput: show })),
            calc,
            h('button', { type: 'button', class: 'btn btn--danger btn--small', 'aria-label': `Quitar duración ${i + 1}`, onclick: () => (pr.hours.splice(i, 1), rerender()) }, 'Quitar'),
          );
        }),
        pr.hours.length ? null : h('p', { class: 'empty' }, 'Sin duraciones.'),
      ),
      h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => (pr.hours.push((pr.hours.filter(isHours).at(-1) ?? 0) + 1), rerender()) }, 'Añadir duración')),
    );
  } else if (pr.unit === 'package') {
    if (!Array.isArray(pr.packages)) pr.packages = [];
    body.push(
      h('h4', { class: 'subhead' }, 'Paquetes (precio por persona)'),
      h(
        'div',
        {},
        pr.packages.map((k, i) =>
          h(
            'div',
            { class: 'line-row line-row--pkg' },
            field('Días', numInput(k, 'days', { check: (n) => isWhole(n, 60), label: `Paquete ${i + 1}: días`, step: '1', min: 1 })),
            field('Horas en total', numInput(k, 'hours', { check: isTotalHours, label: `Paquete ${i + 1}: horas`, step: '0.5' })),
            field('Precio (€)', numInput(k, 'amount', { check: isPrice, label: `Paquete ${i + 1}: precio por persona`, step: '0.01' })),
            h('button', { type: 'button', class: 'btn btn--danger btn--small', 'aria-label': `Quitar paquete ${i + 1}`, onclick: () => (pr.packages.splice(i, 1), rerender()) }, 'Quitar'),
          ),
        ),
        pr.packages.length ? null : h('p', { class: 'empty' }, 'Sin paquetes.'),
      ),
      h(
        'div',
        { class: 'panel__actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--ghost btn--small',
            onclick: () => {
              const last = pr.packages.at(-1);
              const days = (isWhole(last?.days, 60) ? last.days : 0) + 1;
              const perDay = last && typeof last.hours === 'number' && isWhole(last.days, 60) ? last.hours / last.days : 2;
              pr.packages.push({ days, hours: perDay * days, amount: '' });
              rerender();
            },
          },
          'Añadir paquete',
        ),
        h('span', { class: 'hint' }, 'Un paquete nuevo empieza sin precio: escríbelo antes de guardar.'),
      ),
    );
  } else {
    body.push(h('p', { class: 'hint' }, `Tipo de precio «${pr.unit ?? '—'}»: no se edita desde aquí.`));
  }
  return card({ title, meta: pr.unit === 'personHour' ? 'Precio por persona y hora' : pr.unit === 'package' ? 'Paquetes por días' : null, body });
}

function renderTeam(panel) {
  const list = S.files.team.data.instructors ?? (S.files.team.data.instructors = []);
  fill(panel,
    intro('Instructores', 'Fichas de la página Instructores, en este orden. Foto vertical 4:5. Cada instructor debe tener una foto distinta: una foto ya usada no se puede elegir para otra ficha.', FILES.team),
    h('div', { class: 'cards' }, list.map((p, i) => teamCard(p, i, list))),
    h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn', onclick: () => addInstructor(list, panel) }, 'Añadir instructor')),
  );
}

function addInstructor(list, panel) {
  const ids = new Set(list.map((p) => p.id));
  let n = list.length + 1;
  while (ids.has(`instructor-${n}`)) n++;
  list.push({ id: `instructor-${n}`, photo: null, name: { es: '', en: '' }, role: { es: 'Monitor de surf', en: 'Surf instructor' }, bio: { es: '', en: '' }, certificates: [] });
  rerender();
  scrollToLast(panel, '.card');
}

function teamCard(p, i, list) {
  const title = h('span', {}, L(p.name) || 'Instructor sin nombre');
  if (!Array.isArray(p.certificates)) p.certificates = [];
  const certs = p.certificates;
  const photoCol = h(
    'div',
    { class: 'photo-col' },
    thumb(p.photo, { portrait: true }),
    h('p', { class: 'photo-name mono' }, p.photo || 'Sin foto (se muestra «foto pendiente»)'),
    h(
      'div',
      { class: 'photo-tools' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => chooseTeamPhoto(p, list) }, p.photo ? 'Cambiar foto' : 'Elegir foto'),
      p.photo ? h('button', { type: 'button', class: 'btn btn--quiet btn--small', onclick: () => ((p.photo = null), rerender()) }, 'Quitar foto') : null,
    ),
  );
  const certRows = certs.map((c, j) => {
    const val = { es: typeof c === 'object' ? (c?.es ?? '') : (c ?? ''), en: typeof c === 'object' ? (c?.en ?? '') : '' };
    // English left empty → one text for both languages (stored as a plain string)
    const write = () => (certs[j] = !val.en || val.en === val.es ? val.es : { es: val.es, en: val.en });
    return h(
      'div',
      { class: 'line-row line-row--cert' },
      field('Certificado (ES)', textInput(val.es, (v) => ((val.es = v), write()))),
      field('Certificate (EN)', textInput(val.en, (v) => ((val.en = v), write()), { placeholder: 'Igual que en español' })),
      h('button', { type: 'button', class: 'btn btn--danger btn--small', 'aria-label': `Quitar certificado ${j + 1}`, onclick: () => (certs.splice(j, 1), rerender()) }, 'Quitar'),
    );
  });
  return card({
    title,
    num: i + 1,
    meta: p.id,
    tools: orderTools(list, i, 'team', `la ficha de ${L(p.name) || `instructor ${i + 1}`}`),
    body: h(
      'div',
      { class: 'card__split' },
      photoCol,
      h(
        'div',
        {},
        bi(p, 'name', 'Nombre', { onInput: (lang) => lang === 'es' && (title.textContent = L(p.name) || 'Instructor sin nombre') }),
        bi(p, 'role', 'Puesto'),
        bi(p, 'bio', 'Biografía', { multiline: true, rows: 4, hint: 'Vacía = la web muestra «pendiente» mientras el modo revisión esté activado.' }),
        h('h4', { class: 'subhead' }, 'Certificados'),
        certRows.length ? certRows : h('p', { class: 'empty' }, 'Sin certificados.'),
        h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => (certs.push(''), rerender()) }, 'Añadir certificado')),
      ),
    ),
  });
}

function chooseTeamPhoto(p, list) {
  const used = new Map(list.filter((o) => o !== p && o.photo).map((o) => [o.photo, L(o.name) || o.id]));
  openPicker({
    title: `Foto de ${L(p.name) || 'instructor'}`,
    used,
    ratio: 4 / 5,
    ratioLabel: 'Recortar a 4:5 vertical (el formato de las fichas)',
    base: () => `team-${slugify(L(p.name) || p.id, 'instructor')}`,
    onPick: ([name]) => {
      p.photo = name;
      rerender();
    },
  });
}

function renderGallery(panel) {
  const items = S.files.gallery.data.items ?? (S.files.gallery.data.items = []);
  const status = h('p', { class: 'picker__status', role: 'status' });
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, 'data-upload': 'gallery' });
  const addNames = (names) => {
    for (const image of names) items.push({ image, category: 'lessons', alt: { es: '' } });
    if (names.length) {
      rerender();
      scrollToLast(panel, '.gallery .card');
    }
  };
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    if (files.length) addNames(await processFiles(files, { base: (f) => f.name.replace(/\.[^.]+$/, ''), status }));
  });
  const counts = Object.keys(CATEGORIES).map((c) => `${CATEGORIES[c]}: ${items.filter((g) => g.category === c).length}`);
  fill(panel,
    intro('Galería', `Fotos de la página Galería, en este orden, con su filtro (Clases o Instructores). ${counts.join(' · ')}.`, FILES.gallery),
    h(
      'div',
      { class: 'panel__actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => input.click() }, 'Subir fotos'),
      input,
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost',
          onclick: () => openPicker({ title: 'Añadir a la galería', marks: new Map(items.map((g) => [g.image, 'Ya en la galería'])), multiple: true, base: (f) => f.name.replace(/\.[^.]+$/, ''), onPick: addNames }),
        },
        'Añadir una foto existente',
      ),
      status,
    ),
    h(
      'div',
      { class: 'gallery' },
      items.map((g, i) => {
        const select = h('select', { 'aria-label': `Categoría de la foto ${i + 1}` }, Object.entries(CATEGORIES).map(([v, label]) => h('option', { value: v, selected: g.category === v }, label)));
        select.addEventListener('change', () => {
          g.category = select.value;
          changed();
        });
        return card({
          title: g.image,
          num: i + 1,
          tools: orderTools(items, i, 'gal', `la foto ${i + 1}`),
          body: [thumb(g.image), field('Categoría (filtro)', select), bi(g, 'alt', 'Descripción de la foto', { enOptional: true, hint: 'Si dejas el inglés vacío, la web en inglés usa el texto en español.' })],
        });
      }),
    ),
    items.length ? null : h('p', { class: 'empty' }, 'La galería está vacía.'),
  );
}

function renderReviews(panel) {
  const cfg = S.files.config.data;
  if (!cfg.reviews || typeof cfg.reviews !== 'object') cfg.reviews = { googleUrl: '', items: [] };
  const rv = cfg.reviews;
  if (!Array.isArray(rv.items)) rv.items = [];
  const items = rv.items;
  fill(panel,
    intro('Opiniones', 'Opiniones escogidas que se muestran en la portada, en este orden. Sin opiniones, la portada muestra huecos de ejemplo mientras el modo revisión esté activado.', `${FILES.config} → reviews`),
    h('div', { class: 'grid-2' }, field('Enlace a las opiniones de Google', textInput(rv.googleUrl, (v) => (rv.googleUrl = v.trim()), { type: 'url', inputmode: 'url', placeholder: 'https://g.page/r/…', spellcheck: 'false' }), 'Vacío = no se muestra el botón «Ver en Google».')),
    h(
      'div',
      { class: 'cards cards--2' },
      items.map((r, i) => {
        const title = h('span', {}, r.name || 'Opinión sin nombre');
        const rating = h('select', { 'aria-label': 'Valoración' }, [5, 4, 3, 2, 1].map((n) => h('option', { value: n, selected: Number(r.rating) === n }, `${'★'.repeat(n)}${'☆'.repeat(5 - n)}  (${n})`)));
        rating.addEventListener('change', () => {
          r.rating = Number(rating.value);
          changed();
        });
        const date = textInput(r.date, (v, el) => ((r.date = v), el.setAttribute('aria-invalid', String(!isDate(v)))), { type: 'date' });
        return card({
          title,
          num: i + 1,
          tools: orderTools(items, i, 'rev', `la opinión de ${r.name || `la ficha ${i + 1}`}`),
          body: [
            field('Nombre', textInput(r.name, (v) => ((r.name = v), (title.textContent = v || 'Opinión sin nombre')), { autocomplete: 'off' })),
            h('div', { class: 'grid-2' }, field('Fecha', date, 'Se muestra como mes y año.'), field('Valoración', rating)),
            bi(r, 'text', 'Texto', { multiline: true, rows: 4, enOptional: true, hint: 'Si dejas el inglés vacío, la web en inglés muestra el texto en español.' }),
          ],
        });
      }),
    ),
    items.length ? null : h('p', { class: 'empty' }, 'Todavía no hay opiniones.'),
    h(
      'div',
      { class: 'panel__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onclick: () => {
            items.push({ name: '', date: today(), rating: 5, text: { es: '' } });
            rerender();
            scrollToLast(panel, '.card');
          },
        },
        'Añadir opinión',
      ),
    ),
  );
}

function renderSettings(panel) {
  const cfg = S.files.config.data;
  const text = (path, label, { check, hint, type = 'text', trim = true, ...attrs } = {}) => {
    const el = textInput(
      getPath(cfg, path),
      (v, input) => {
        setPath(cfg, path, trim ? v.trim() : v);
        if (check) input.setAttribute('aria-invalid', String(Boolean(v.trim()) && !check(v.trim())));
      },
      { type, spellcheck: type === 'text' ? null : 'false', autocomplete: 'off', ...attrs },
    );
    if (check) el.setAttribute('aria-invalid', String(Boolean(el.value) && !check(el.value)));
    return field(label, el, hint);
  };
  const video = h('select', {}, h('option', { value: '' }, 'Sin vídeo: se muestra la foto principal'), [...new Set([...S.videos, cfg.hero?.video].filter(Boolean))].map((v) => h('option', { value: v, selected: v === cfg.hero?.video }, S.videos.includes(v) ? v : `${v} (no encontrado)`)));
  video.addEventListener('change', () => {
    setPath(cfg, ['hero', 'video'], video.value);
    changed();
  });
  const review = h('input', { type: 'checkbox', checked: cfg.reviewMode === true });
  review.addEventListener('change', () => {
    cfg.reviewMode = review.checked;
    changed();
  });
  const group = (title, ...kids) => h('fieldset', { class: 'card card__body' }, h('legend', {}, title), kids);
  fill(panel,
    intro('Ajustes / contacto', 'Datos de contacto, WhatsApp, redes sociales y opciones generales. El resto de site.config.json (formularios, pagos, mapas, previsiones) se queda como está.', FILES.config),
    h(
      'div',
      { class: 'cards cards--2' },
      group('Contacto', text(['contact', 'email'], 'Email', { type: 'email', inputmode: 'email', check: isEmail }), text(['contact', 'address'], 'Dirección', { trim: false })),
      group(
        'WhatsApp',
        text(['whatsapp', 'number'], 'Número (para los enlaces)', { inputmode: 'numeric', check: isWhatsapp, hint: 'Solo dígitos, con el prefijo del país y sin + ni espacios. Ejemplo: 34688681436.' }),
        text(['whatsapp', 'display'], 'Número tal como se muestra', { trim: false, hint: 'Ejemplo: 688 68 14 36.' }),
      ),
      group(
        'Redes sociales',
        h('div', { class: 'grid-2' }, text(['social', 'instagram', 'url'], 'Instagram: enlace', { type: 'url', inputmode: 'url', check: isHttps }), text(['social', 'instagram', 'handle'], 'Instagram: usuario', { placeholder: '@usuario' })),
        h('div', { class: 'grid-2' }, text(['social', 'facebook', 'url'], 'Facebook: enlace', { type: 'url', inputmode: 'url', check: isHttps }), text(['social', 'facebook', 'handle'], 'Facebook: usuario', { placeholder: '@usuario' })),
      ),
      group('Portada', field('Vídeo de fondo', video, `Vídeos disponibles en ${VIDEO_DIR}. Sin vídeo se muestra la foto principal; con vídeo, la foto es la imagen de espera.`)),
      group(
        'Web',
        text(['siteUrl'], 'Dirección definitiva de la web', { type: 'url', inputmode: 'url', check: isHttps, placeholder: 'https://www.ejemplo.com', hint: 'Se usa para el mapa del sitio y las etiquetas para buscadores. Déjala vacía mientras no haya dominio propio.' }),
        h('label', { class: 'check' }, review, 'Modo revisión (avisos «pendiente» en ámbar)'),
        h('p', { class: 'hint' }, 'Activado: la web marca en ámbar todo lo que la academia aún tiene que entregar (fotos, biografías, certificados, opiniones). Desactívalo antes del lanzamiento: con el modo revisión desactivado esos avisos «pendiente» desaparecen de la web.'),
      ),
    ),
  );
}

function renderTexts(panel) {
  const st = S.texts;
  const loc = S.locale;
  const groups = [...new Set(loc.ids.map((id) => id.split('.')[0]))];
  const search = h('input', { type: 'search', value: st.q, placeholder: 'Buscar por texto o clave…', autocomplete: 'off', spellcheck: 'false' });
  const group = h('select', {}, h('option', { value: '' }, 'Todas las secciones'), groups.map((g) => h('option', { value: g, selected: st.group === g }, g)));
  const onlyChanged = h('input', { type: 'checkbox', checked: st.changed });
  const count = h('p', { class: 't-count', role: 'status' });
  const list = h('div', { class: 't-list' });
  const more = h('div', { class: 't-more' });

  const current = (id, lang) => S.edits.get(id)?.[lang] ?? loc[lang].get(id);
  const setEdit = (id, lang, v) => {
    const base = loc[lang].get(id);
    const e = { ...S.edits.get(id) };
    if (v === base || (base === undefined && v === '')) delete e[lang];
    else e[lang] = v;
    if (Object.keys(e).length) S.edits.set(id, e);
    else S.edits.delete(id);
    changed();
  };
  const row = (id) => {
    const badge = h('span', { class: 'badge-changed', hidden: !S.edits.has(id) }, 'Modificado');
    const el = h('div', { class: `t-row${S.edits.has(id) ? ' is-changed' : ''}` });
    const col = (lang) => {
      const v = current(id, lang);
      const editable = v === undefined || typeof v === 'string';
      const ta = autoGrow(h('textarea', { rows: 1, value: editable ? (v ?? '') : JSON.stringify(v), readonly: editable ? null : true, placeholder: v === undefined ? `(falta en ${lang === 'es' ? 'español' : 'inglés'})` : null, 'aria-label': `${id} (${lang === 'es' ? 'español' : 'inglés'})`, 'data-lang': lang }));
      if (editable)
        ta.addEventListener('input', () => {
          setEdit(id, lang, ta.value);
          badge.hidden = !S.edits.has(id);
          el.classList.toggle('is-changed', S.edits.has(id));
        });
      return h('div', { class: 't-row__col' }, h('span', { class: `lang lang--${lang}`, 'aria-hidden': 'true' }, lang.toUpperCase()), ta);
    };
    el.append(h('div', { class: 't-row__key mono' }, id, badge), h('div', { class: 't-row__cols' }, col('es'), col('en')));
    return el;
  };
  const draw = () => {
    const q = norm(st.q.trim());
    const ids = loc.ids.filter((id) => (!st.group || id.split('.')[0] === st.group) && (!st.changed || S.edits.has(id)) && (!q || norm(`${id}\n${current(id, 'es') ?? ''}\n${current(id, 'en') ?? ''}`).includes(q)));
    count.textContent = `${plural(ids.length, 'texto', 'textos')}${ids.length > st.limit ? `, se muestran ${st.limit}` : ''} · ${plural(S.edits.size, 'modificado', 'modificados')}`;
    fill(list, ...ids.slice(0, st.limit).map(row));
    fill(more, ids.length > st.limit ? h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => ((st.limit += 40), draw()) }, `Mostrar más (${ids.length - st.limit} restantes)`) : '');
    if (!ids.length) list.append(h('p', { class: 'empty' }, 'Ningún texto coincide con la búsqueda.'));
  };
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      st.q = search.value;
      st.limit = 40;
      draw();
    }, 150);
  });
  group.addEventListener('change', () => ((st.group = group.value), (st.limit = 40), draw()));
  onlyChanged.addEventListener('change', () => ((st.changed = onlyChanged.checked), (st.limit = 40), draw()));

  fill(panel,
    intro('Textos', 'Todos los textos de la web en español e inglés. Busca una palabra, cámbiala en los dos idiomas y guarda: los dos archivos se guardan juntos en un solo cambio. Puedes usar <br> para forzar un salto de línea.', `${FILES.es} · ${FILES.en}`),
    h('div', { class: 't-controls' }, field('Buscar', search), field('Sección', group), h('label', { class: 'check' }, onlyChanged, 'Solo modificados')),
    count,
    list,
    more,
  );
  draw();
}

// ================================================================ start

function init() {
  $('#repo-name').textContent = `${REPO.owner}/${REPO.repo}`;
  for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => selectTab(b.dataset.tab));
  $('.tabs__list').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...document.querySelectorAll('.tab')];
    const i = tabs.findIndex((b) => b.dataset.tab === S.tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next.dataset.tab);
    next.focus();
  });
  $('#connect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const token = $('#token').value.trim();
    if (!token) return showConnect('Pega el token de GitHub.');
    if (/\s/.test(token)) return showConnect('El token no puede tener espacios. Cópialo de nuevo.');
    connect(token);
  });
  $('#btn-preview').addEventListener('click', startPreview);
  $('#btn-forget-stored').addEventListener('click', forgetToken);
  $('#btn-save').addEventListener('click', save);
  $('#btn-discard').addEventListener('click', discard);
  addEventListener('beforeunload', (e) => {
    if (S.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  showConnect();
  const saved = store.get(TOKEN_KEY);
  if (saved) connect(saved);
}

if (typeof document !== 'undefined' && document.getElementById('app')) init();
