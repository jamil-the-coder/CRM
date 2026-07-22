-- CreateTable
CREATE TABLE "call_bookings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "external_event_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "attendee_email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_bookings_tenant_id_idx" ON "call_bookings"("tenant_id");

-- AddForeignKey
ALTER TABLE "call_bookings" ADD CONSTRAINT "call_bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_bookings" ADD CONSTRAINT "call_bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
