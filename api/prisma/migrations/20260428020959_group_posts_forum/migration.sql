-- CreateTable
CREATE TABLE "group_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "group_posts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_post_reactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "group_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_post_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "group_post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "group_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_post_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "group_post_comments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "group_post_comment_reactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_post_comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "group_post_comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "group_post_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "group_posts_groupId_createdAt_idx" ON "group_posts"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "group_post_reactions_postId_userId_emoji_key" ON "group_post_reactions"("postId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "group_post_comments_postId_createdAt_idx" ON "group_post_comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "group_post_comments_parentCommentId_idx" ON "group_post_comments"("parentCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "group_post_comment_reactions_commentId_userId_emoji_key" ON "group_post_comment_reactions"("commentId", "userId", "emoji");
