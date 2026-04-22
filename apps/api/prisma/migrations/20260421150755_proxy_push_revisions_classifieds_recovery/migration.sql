-- CreateEnum
CREATE TYPE "RevisionType" AS ENUM ('BOILER', 'ELEVATOR', 'CHIMNEY', 'ELECTRICAL', 'FIRE_SAFETY', 'GAS', 'LIGHTNING_ROD', 'PLAYGROUND', 'OTHER');

-- CreateEnum
CREATE TYPE "ClassifiedType" AS ENUM ('FOR_SALE', 'WANTED', 'GIVEAWAY', 'LOST_AND_FOUND', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ClassifiedStatus" AS ENUM ('ACTIVE', 'CLOSED', 'REMOVED');

-- AlterTable
ALTER TABLE "VoteRecord" ADD COLUMN     "proxyDocumentKey" TEXT,
ADD COLUMN     "proxyFromApartmentId" TEXT;

-- CreateTable
CREATE TABLE "TotpRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotpRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "type" "RevisionType" NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "lastDoneAt" TIMESTAMP(3),
    "intervalMonths" INTEGER,
    "contractorName" TEXT,
    "contractorPhone" TEXT,
    "contractorEmail" TEXT,
    "notes" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reportPdfKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classified" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "ClassifiedType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priceEur" DECIMAL(10,2),
    "contactPhone" TEXT,
    "contactApartment" TEXT,
    "status" "ClassifiedStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Classified_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TotpRecoveryCode_codeHash_key" ON "TotpRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "TotpRecoveryCode_userId_idx" ON "TotpRecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Revision_buildingId_dueDate_idx" ON "Revision"("buildingId", "dueDate");

-- CreateIndex
CREATE INDEX "Revision_dueDate_idx" ON "Revision"("dueDate");

-- CreateIndex
CREATE INDEX "Classified_buildingId_status_createdAt_idx" ON "Classified"("buildingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Classified_authorId_idx" ON "Classified"("authorId");

-- CreateIndex
CREATE INDEX "VoteRecord_proxyFromApartmentId_idx" ON "VoteRecord"("proxyFromApartmentId");

-- AddForeignKey
ALTER TABLE "TotpRecoveryCode" ADD CONSTRAINT "TotpRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classified" ADD CONSTRAINT "Classified_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classified" ADD CONSTRAINT "Classified_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
