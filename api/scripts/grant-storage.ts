import path from 'path';
import { config as loadEnv } from 'dotenv';
import { groupStorage } from '../src/services/GroupStorageService';
import { formatStorageBytes, gbToBytes } from '../src/utils/groupStorageLimits';

loadEnv({ path: path.resolve(__dirname, '../.env') });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return undefined;
}

async function main(): Promise<void> {
  const groupId = arg('group')?.trim();
  if (!groupId) {
    throw new Error('Usage: npm run storage:grant -- --group <groupId> --gb <n>');
  }
  const gbRaw = arg('gb');
  const bytesRaw = arg('bytes');
  let cap: number;
  if (gbRaw != null) {
    const gb = Number(gbRaw);
    if (!Number.isFinite(gb) || gb < 1) {
      throw new Error('--gb must be at least 1');
    }
    cap = gbToBytes(gb);
  } else if (bytesRaw != null) {
    cap = Math.floor(Number(bytesRaw));
    if (!Number.isFinite(cap) || cap < 1) {
      throw new Error('--bytes must be at least 1');
    }
  } else {
    throw new Error('Usage: npm run storage:grant -- --group <groupId> --gb <n>');
  }

  await groupStorage.grantStorage(groupId, cap);
  console.log(`Granted ${formatStorageBytes(cap)} to group ${groupId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
