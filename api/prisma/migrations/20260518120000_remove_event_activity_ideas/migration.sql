-- Drop event activity ideas (replaced by polls).

DROP TABLE IF EXISTS "event_activity_votes";
DROP TABLE IF EXISTS "event_activity_options";

-- SQLite: DROP COLUMN has no IF EXISTS; columns exist on DBs that ran init migration.
ALTER TABLE "events" DROP COLUMN "activityIdeasEnabled";
ALTER TABLE "events" DROP COLUMN "activityVotesAnonymous";
