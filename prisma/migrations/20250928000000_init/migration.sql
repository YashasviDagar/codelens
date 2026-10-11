-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RepoPermission" AS ENUM ('READ', 'WRITE', 'ADMIN');

-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('OPEN', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('QUEUED', 'ANALYZING', 'STATIC_ANALYSIS', 'AI_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('BUG', 'CODE_QUALITY', 'PERFORMANCE', 'MAINTAINABILITY', 'TESTING', 'DOCUMENTATION', 'SECURITY', 'STYLE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('STATIC_ANALYSIS', 'AST', 'METRICS', 'RULE_ENGINE', 'AI');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'FIXED', 'FALSE_POSITIVE', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('HELPFUL', 'NOT_HELPFUL', 'FALSE_POSITIVE', 'WONT_FIX', 'FIXED');

-- CreateEnum
CREATE TYPE "CommentKind" AS ENUM ('PR_SUMMARY', 'INLINE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "githubToken" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryMember" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "RepoPermission" NOT NULL DEFAULT 'WRITE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubPrNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "branchName" TEXT,
    "baseSha" TEXT,
    "headSha" TEXT,
    "status" "PRStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "filesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "linesChanged" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "severityCounts" JSONB,
    "qualityScore" INTEGER,
    "durationMs" INTEGER,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "configHash" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "line" INTEGER,
    "endLine" INTEGER,
    "category" "Category" NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "recommendation" TEXT,
    "suggestedPatch" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "FindingSource" NOT NULL,
    "ruleId" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingFeedback" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "findingId" TEXT,
    "userId" TEXT NOT NULL,
    "githubId" BIGINT,
    "body" TEXT NOT NULL,
    "kind" "CommentKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "User_login_idx" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Repository_owner_name_idx" ON "Repository"("owner", "name");

-- CreateIndex
CREATE INDEX "RepositoryMember_userId_idx" ON "RepositoryMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryMember_repositoryId_userId_key" ON "RepositoryMember"("repositoryId", "userId");

-- CreateIndex
CREATE INDEX "PullRequest_repositoryId_status_idx" ON "PullRequest"("repositoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequest_repositoryId_githubPrNumber_key" ON "PullRequest"("repositoryId", "githubPrNumber");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_commitSha_idx" ON "Review"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "Review_pullRequestId_commitSha_key" ON "Review"("pullRequestId", "commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_externalId_key" ON "Finding"("externalId");

-- CreateIndex
CREATE INDEX "Finding_reviewId_idx" ON "Finding"("reviewId");

-- CreateIndex
CREATE INDEX "Finding_severity_status_idx" ON "Finding"("severity", "status");

-- CreateIndex
CREATE INDEX "Finding_category_idx" ON "Finding"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_reviewId_file_line_ruleId_key" ON "Finding"("reviewId", "file", "line", "ruleId");

-- CreateIndex
CREATE INDEX "FindingFeedback_userId_createdAt_idx" ON "FindingFeedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FindingFeedback_findingId_userId_key" ON "FindingFeedback"("findingId", "userId");

-- CreateIndex
CREATE INDEX "ReviewComment_reviewId_idx" ON "ReviewComment"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewComment_githubId_key" ON "ReviewComment"("githubId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryMember" ADD CONSTRAINT "RepositoryMember_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryMember" ADD CONSTRAINT "RepositoryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequest" ADD CONSTRAINT "PullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "PullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingFeedback" ADD CONSTRAINT "FindingFeedback_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingFeedback" ADD CONSTRAINT "FindingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

