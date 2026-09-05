'use dom';

import { useEffect, useState } from 'react';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const MAMMOTH_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const MAX_TABLE_ROWS = 200;
const MAX_ZIP_ENTRIES = 400;
const MAX_TEXT_CHARS = 200_000;

type JSZipObject = { dir: boolean };
type JSZipInstance = {
  files: Record<string, JSZipObject>;
  file: (name: string) => { async: (type: 'string' | 'arraybuffer') => Promise<string | ArrayBuffer> } | null;
};

type MammothLib = {
  convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
};

type XlsxLib = {
  read: (data: Uint8Array, opts: { type: 'array' }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (sheet: unknown, opts: { header: number; defval: string }) => unknown[][];
  };
};

function loadScript(src: string): Promise<void> {
  const w = window as Window & { JSZip?: unknown; mammoth?: MammothLib; XLSX?: XlsxLib };
  if (src === JSZIP_SRC && w.JSZip) return Promise.resolve();
  if (src === MAMMOTH_SRC && w.mammoth) return Promise.resolve();
  if (src === XLSX_SRC && w.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(src)));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(src));
    document.head.appendChild(s);
  });
}

async function loadJSZip(): Promise<{ loadAsync: (data: Uint8Array) => Promise<JSZipInstance> }> {
  await loadScript(JSZIP_SRC);
  const lib = (window as Window & { JSZip?: { loadAsync: (data: Uint8Array) => Promise<JSZipInstance> } }).JSZip;
  if (!lib) throw new Error('jszip missing');
  return lib;
}

async function loadMammoth(): Promise<MammothLib> {
  await loadScript(MAMMOTH_SRC);
  const lib = (window as Window & { mammoth?: MammothLib }).mammoth;
  if (!lib) throw new Error('mammoth missing');
  return lib;
}

async function loadXlsx(): Promise<XlsxLib> {
  await loadScript(XLSX_SRC);
  const lib = (window as Window & { XLSX?: XlsxLib }).XLSX;
  if (!lib) throw new Error('xlsx missing');
  return lib;
}

function decodeBase64(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function wrapHtml(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; background: #fff; color: #18181b; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.45; padding: 16px; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: max-content; min-width: 100%; font-size: 13px; margin: 8px 0 20px; }
    td, th { border: 1px solid #e4e4e7; padding: 5px 8px; text-align: left; vertical-align: top; white-space: pre-wrap; }
    th { background: #f4f4f5; font-weight: 600; }
    h1, h2, h3 { line-height: 1.25; }
    h2 { font-size: 16px; margin: 20px 0 8px; }
    .zip-row { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f4f4f5; word-break: break-all; }
    .zip-dir { color: #71717a; }
    .slide { border: 1px solid #e4e4e7; border-radius: 8px; padding: 14px 16px; margin: 0 0 14px; background: #fafafa; }
    .slide h3 { margin: 0 0 8px; font-size: 13px; color: #71717a; font-weight: 600; }
    .slide p { margin: 0; white-space: pre-wrap; }
    .muted { color: #71717a; font-size: 13px; }
    .note { color: #71717a; font-size: 12px; margin-top: 12px; }
  </style></head><body>${body}</body></html>`;
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d*[ ]?/g, '')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function odfToHtml(xml: string): string {
  const withBreaks = xml
    .replace(/<text:line-break\b[^>]*\/>/gi, '\n')
    .replace(/<text:p\b[^>]*>/gi, '\n')
    .replace(/<text:h\b[^>]*>/gi, '\n\n')
    .replace(/<table:table-cell\b[^>]*>/gi, '\t')
    .replace(/<table:table-row\b[^>]*>/gi, '\n');
  const text = decodeXml(withBreaks.replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  return wrapHtml(`<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text || '(Empty document)')}</pre>`);
}

function zipListingHtml(zip: JSZipInstance): string {
  const names = Object.keys(zip.files)
    .filter((p) => !/(^|\/)(__MACOSX|\.DS_Store)(\/|$)/i.test(p))
    .sort((a, b) => a.localeCompare(b));
  const extra = Math.max(0, names.length - MAX_ZIP_ENTRIES);
  const rows = names.slice(0, MAX_ZIP_ENTRIES).map((path) => {
    const dir = zip.files[path]?.dir;
    return `<div class="zip-row${dir ? ' zip-dir' : ''}">${escapeHtml(path)}${dir ? '/' : ''}</div>`;
  });
  const note = extra > 0 ? `<p class="note">…and ${extra} more</p>` : '';
  return wrapHtml(`<p class="muted">${names.length} item${names.length === 1 ? '' : 's'}</p>${rows.join('')}${note}`);
}

async function pptxSlidesHtml(zip: JSZipInstance): Promise<string> {
  const paths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml/i.exec(a)?.[1] || 0);
      const nb = Number(/slide(\d+)\.xml/i.exec(b)?.[1] || 0);
      return na - nb;
    });
  if (!paths.length) throw new Error('no slides');
  const blocks: string[] = [];
  for (let i = 0; i < paths.length; i++) {
    const file = zip.file(paths[i]);
    const xml = file ? String(await file.async('string')) : '';
    const paras = xml.split(/<\/a:p>/i).map((p) => {
      const texts = [...p.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/gi)].map((m) => decodeXml(m[1] || ''));
      return texts.join('');
    });
    const body = paras.filter((p) => p.trim()).join('\n') || '(Empty slide)';
    blocks.push(`<section class="slide"><h3>Slide ${i + 1}</h3><p>${escapeHtml(body)}</p></section>`);
  }
  return wrapHtml(blocks.join(''));
}

function sheetsToHtml(xlsx: XlsxLib, bytes: Uint8Array): string {
  const wb = xlsx.read(bytes, { type: 'array' });
  const parts = wb.SheetNames.map((name) => {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const clipped = rows.slice(0, MAX_TABLE_ROWS);
    const width = Math.max(1, ...clipped.map((r) => r.length));
    const tableRows = clipped.map((row, ri) => {
      const cells = Array.from({ length: width }, (_, ci) => {
        const tag = ri === 0 ? 'th' : 'td';
        return `<${tag}>${escapeHtml(String(row[ci] ?? ''))}</${tag}>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    });
    const note =
      rows.length > MAX_TABLE_ROWS ? `<p class="note">Showing first ${MAX_TABLE_ROWS} rows</p>` : '';
    return `<h2>${escapeHtml(name)}</h2><table>${tableRows.join('')}</table>${note}`;
  });
  return wrapHtml(parts.join('') || '<p class="muted">Empty workbook</p>');
}

async function previewBytes(bytes: Uint8Array, ext: string): Promise<string> {
  if (ext === 'rtf') {
    const text = rtfToText(new TextDecoder('utf-8').decode(bytes));
    return wrapHtml(`<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text || '(Empty document)')}</pre>`);
  }

  let zip: JSZipInstance | null = null;
  try {
    const JSZip = await loadJSZip();
    zip = await JSZip.loadAsync(bytes);
  } catch {
    zip = null;
  }

  if (zip) {
    if (zip.file('word/document.xml')) {
      const mammoth = await loadMammoth();
      const { value } = await mammoth.convertToHtml({ arrayBuffer: toArrayBuffer(bytes) });
      return wrapHtml(value || '<p class="muted">Empty document</p>');
    }
    if (zip.file('xl/workbook.xml')) {
      const xlsx = await loadXlsx();
      return sheetsToHtml(xlsx, bytes);
    }
    if (zip.file('ppt/presentation.xml')) {
      return pptxSlidesHtml(zip);
    }
    if (zip.file('content.xml')) {
      const file = zip.file('content.xml');
      const xml = file ? String(await file.async('string')) : '';
      return odfToHtml(xml);
    }
    return zipListingHtml(zip);
  }

  if (/^(xlsx?|csv)$/i.test(ext)) {
    const xlsx = await loadXlsx();
    return sheetsToHtml(xlsx, bytes);
  }
  throw new Error('unsupported');
}

export default function DocumentPreview({
  data,
  ext,
  onFailed,
}: {
  data?: string;
  ext?: string;
  onFailed?: () => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      void onFailed?.();
      return;
    }
    let cancelled = false;
    setHtml(null);
    void (async () => {
      try {
        const next = await previewBytes(decodeBase64(data), (ext || '').toLowerCase());
        if (!cancelled) setHtml(next);
      } catch {
        if (!cancelled) void onFailed?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, ext, onFailed]);

  if (!html) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
        }}
      >
        Loading preview…
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      sandbox=""
      title="Document preview"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#fff',
        borderRadius: 8,
      }}
    />
  );
}
