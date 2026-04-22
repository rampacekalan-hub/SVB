-- AlterTable
ALTER TABLE "Voting" ADD COLUMN     "meetingId" TEXT;

-- CreateIndex
CREATE INDEX "Voting_meetingId_idx" ON "Voting"("meetingId");

-- AddForeignKey
ALTER TABLE "Voting" ADD CONSTRAINT "Voting_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
