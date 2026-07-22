-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "external_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_tenant_id_idx" ON "invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "invoices_opportunity_id_idx" ON "invoices"("opportunity_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
