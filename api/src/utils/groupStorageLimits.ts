export const DEFAULT_GROUP_MAX_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;
export const MIN_GROUP_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
export const MAX_OWNER_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024 * 1024;

export function storageBytesFromDb(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  if (typeof raw === 'bigint') {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
  return 0;
}

export function storageBytesToDb(n: number): string {
  return String(Math.max(0, Math.floor(Number.isFinite(n) ? n : 0)));
}

export function groupMaxStorageBytes(raw: unknown): number {
  const n = storageBytesFromDb(raw);
  if (n <= 0 || n < MIN_GROUP_STORAGE_LIMIT_BYTES) {
    return DEFAULT_GROUP_MAX_STORAGE_BYTES;
  }
  return n;
}

export function formatStorageBytes(bytes: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(bytes) ? bytes : 0));
  const gb = 1024 ** 3;
  const mb = 1024 ** 2;
  const kb = 1024;
  if (n >= gb) {
    const g = n / gb;
    return Number.isInteger(g) || g >= 10 ? `${Math.round(g)} GB` : `${g.toFixed(1)} GB`;
  }
  if (n >= mb) {
    const m = n / mb;
    return Number.isInteger(m) || m >= 10 ? `${Math.round(m)} MB` : `${m.toFixed(1)} MB`;
  }
  if (n >= kb) {
    const k = n / kb;
    return Number.isInteger(k) || k >= 10 ? `${Math.round(k)} KB` : `${k.toFixed(1)} KB`;
  }
  return `${n} B`;
}

export function gbToBytes(gb: number): number {
  return Math.round(gb) * 1024 * 1024 * 1024;
}

export function groupStorageExceededMessage(maxBytes: number): string {
  return `This upload would exceed this group's storage limit (${formatStorageBytes(maxBytes)}).`;
}
