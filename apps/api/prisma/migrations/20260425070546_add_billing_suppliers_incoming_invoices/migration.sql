-- CreateEnum
CREATE TYPE "IncomingInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhonePairingPurpose" AS ENUM ('INCOMING_INVOICE_PHOTO', 'TICKET_PHOTO', 'DOCUMENT_PHOTO');

-- AlterTable
ALTER TABLE "Building" ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingBankName" TEXT,
ADD COLUMN     "billingBic" TEXT,
ADD COLUMN     "billingDic" TEXT,
ADD COLUMN     "billingIban" TEXT,
ADD COLUMN     "billingIco" TEXT,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingRegistry" TEXT,
ADD COLUMN     "billingVatId" TEXT,
ADD COLUMN     "invoiceFooterNote" TEXT,
ADD COLUMN     "invoiceNumberPrefix" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ico" TEXT,
    "dic" TEXT,
    "vatId" TEXT,
    "iban" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "category" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingInvoice" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "supplierId" TEXT,
    "invoiceNumber" TEXT,
    "variableSymbol" TEXT,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "taxableDate" TIMESTAMP(3),
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "iban" TEXT,
    "description" TEXT,
    "category" TEXT,
    "status" "IncomingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(14,2),
    "paidNote" TEXT,
    "createdById" TEXT,
    "ocrText" TEXT,
    "ocrConfidence" DECIMAL(5,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingInvoiceAttachment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "IncomingInvoiceAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhonePairingSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "PhonePairingPurpose" NOT NULL,
    "buildingId" TEXT NOT NULL,
    "contextId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "uploadedKeys" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhonePairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_buildingId_idx" ON "Supplier"("buildingId");

-- CreateIndex
CREATE INDEX "Supplier_buildingId_name_idx" ON "Supplier"("buildingId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_buildingId_ico_key" ON "Supplier"("buildingId", "ico");

-- CreateIndex
CREATE INDEX "IncomingInvoice_buildingId_status_idx" ON "IncomingInvoice"("buildingId", "status");

-- CreateIndex
CREATE INDEX "IncomingInvoice_buildingId_dueDate_idx" ON "IncomingInvoice"("buildingId", "dueDate");

-- CreateIndex
CREATE INDEX "IncomingInvoice_supplierId_idx" ON "IncomingInvoice"("supplierId");

-- CreateIndex
CREATE INDEX "IncomingInvoiceAttachment_invoiceId_idx" ON "IncomingInvoiceAttachment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PhonePairingSession_token_key" ON "PhonePairingSession"("token");

-- CreateIndex
CREATE INDEX "PhonePairingSession_token_idx" ON "PhonePairingSession"("token");

-- CreateIndex
CREATE INDEX "PhonePairingSession_expiresAt_idx" ON "PhonePairingSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoice" ADD CONSTRAINT "IncomingInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoiceAttachment" ADD CONSTRAINT "IncomingInvoiceAttachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "IncomingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingInvoiceAttachment" ADD CONSTRAINT "IncomingInvoiceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
