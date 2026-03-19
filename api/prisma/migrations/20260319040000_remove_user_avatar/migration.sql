/*
  Warnings:

  - You are about to drop the column `avatar` on the `users` table. All the data in the column will be lost.

*/

-- Migrate avatar to avatarSeed where avatarSeed is null
UPDATE "users" SET "avatarSeed" = "avatar" WHERE "avatar" IS NOT NULL AND ("avatarSeed" IS NULL OR "avatarSeed" = '');

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarSeed" TEXT,
    "thumbnail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatarSeed", "createdAt", "displayName", "id", "name", "thumbnail", "updatedAt") SELECT "avatarSeed", "createdAt", "displayName", "id", "name", "thumbnail", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
