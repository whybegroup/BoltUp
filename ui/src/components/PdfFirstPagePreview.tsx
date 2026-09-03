'use dom';

import { useEffect, useRef, useState } from 'react';

const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

type PdfjsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
    }>;
  };
};

function loadPdfJs(): Promise<PdfjsLib> {
  const w = window as Window & { pdfjsLib?: PdfjsLib };
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.async = true;
    s.onload = () => {
      if (!w.pdfjsLib) {
        reject(new Error('pdfjs missing'));
        return;
      }
      resolve(w.pdfjsLib);
    };
    s.onerror = () => reject(new Error('pdfjs script'));
    document.head.appendChild(s);
  });
}

async function setupWorker(pdfjs: PdfjsLib) {
  try {
    const res = await fetch(PDFJS_WORKER);
    const text = await res.text();
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([text], { type: 'application/javascript' })
    );
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
}

function decodeBase64(b64: string): Uint8Array {
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export default function PdfFirstPagePreview({
  mode,
  uri,
  data,
  onFailed,
}: {
  mode: 'document' | 'page';
  uri?: string;
  data?: string;
  onFailed?: () => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState('Loading preview…');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mode === 'document') return;
    if (!data) {
      void onFailed?.();
      return;
    }
    let cancelled = false;
    setReady(false);
    setCaption('Loading preview…');
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        await setupWorker(pdfjs);
        const doc = await pdfjs.getDocument({ data: decodeBase64(data) }).promise;
        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const parentW = canvas.parentElement?.clientWidth || 640;
        const unscaled = page.getViewport({ scale: 1 });
        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const scale = Math.min(2, (parentW * dpr) / unscaled.width);
        const viewport = page.getViewport({ scale: Math.max(0.5, scale) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setReady(true);
        setCaption(doc.numPages > 1 ? `Page 1 of ${doc.numPages}` : '');
      } catch {
        if (!cancelled) {
          setCaption('');
          void onFailed?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, data, onFailed]);

  if (mode === 'document' && uri) {
    return (
      <iframe
        src={uri}
        title="PDF preview"
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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 8,
        boxSizing: 'border-box',
      }}
    >
      {!ready ? (
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
          {caption || 'Could not preview'}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        style={{
          display: ready ? 'block' : 'none',
          maxWidth: '100%',
          maxHeight: caption ? 'calc(100% - 28px)' : '100%',
          width: 'auto',
          height: 'auto',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
        }}
      />
      {ready && caption ? (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'system-ui, sans-serif' }}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}
