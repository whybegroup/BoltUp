export type UploadProgressState = {
  fraction: number;
  current: number;
  total: number;
};

type Session = {
  total: number;
  done: number;
  fileFrac: number;
  auto: boolean;
};

type Listener = (state: UploadProgressState | null) => void;

let session: Session | null = null;
const listeners = new Set<Listener>();

function snapshot(): UploadProgressState | null {
  if (!session) return null;
  const total = Math.max(1, session.total);
  const fraction = Math.min(1, (session.done + session.fileFrac) / total);
  return {
    fraction,
    current: Math.min(total, session.done + 1),
    total,
  };
}

function emit() {
  const next = snapshot();
  listeners.forEach((fn) => fn(next));
}

export function subscribeUploadProgress(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => {
    listeners.delete(fn);
  };
}

export function beginUploadSession(totalFiles: number) {
  session = {
    total: Math.max(1, totalFiles),
    done: 0,
    fileFrac: 0,
    auto: false,
  };
  emit();
}

export function ensureUploadSession() {
  if (!session) {
    session = { total: 1, done: 0, fileFrac: 0, auto: true };
    emit();
  }
}

export function setUploadFileFraction(frac: number) {
  if (!session) return;
  session.fileFrac = Math.max(0, Math.min(1, frac));
  emit();
}

export function completeUploadFile() {
  if (!session) return;
  session.done += 1;
  session.fileFrac = 0;
  emit();
  if (session.auto && session.done >= session.total) {
    endUploadSession();
  }
}

export function abandonUploadSessionIfAuto() {
  if (session?.auto) endUploadSession();
}

export function endUploadSession() {
  session = null;
  emit();
}

export async function withUploadSession<T>(totalFiles: number, fn: () => Promise<T>): Promise<T> {
  beginUploadSession(totalFiles);
  try {
    return await fn();
  } finally {
    endUploadSession();
  }
}
