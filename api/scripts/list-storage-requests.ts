import path from 'path';
import { config as loadEnv } from 'dotenv';
import { groupStorage } from '../src/services/GroupStorageService';
import { formatStorageBytes } from '../src/utils/groupStorageLimits';

loadEnv({ path: path.resolve(__dirname, '../.env') });

async function main(): Promise<void> {
  const rows = await groupStorage.listPendingRequestsForOperator();
  if (rows.length === 0) {
    console.log('No pending storage requests.');
    return;
  }
  for (const r of rows) {
    console.log(
      [
        `group=${r.groupId}`,
        `name=${JSON.stringify(r.groupName)}`,
        `used=${formatStorageBytes(r.usedBytes)}`,
        `current=${formatStorageBytes(r.currentMaxBytes)}`,
        `requested=${formatStorageBytes(r.requestedBytes)}`,
        `by=${r.userId}`,
        r.note ? `note=${JSON.stringify(r.note)}` : null,
      ]
        .filter(Boolean)
        .join('  '),
    );
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
