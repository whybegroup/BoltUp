export const DEFAULT_GROUP_MAX_STORAGE_BYTES = 1024 * 1024 * 1024;

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
