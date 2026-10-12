ALTER TABLE "helpers" ADD COLUMN "deactivatedAt" TIMESTAMPTZ(3);
UPDATE "helpers" SET "deactivatedAt" = "updatedAt" WHERE "active" = false;
CREATE INDEX "helpers_deactivatedAt_idx" ON "helpers"("deactivatedAt");

CREATE TYPE "RetentionKind" AS ENUM ('INACTIVE_HELPER', 'AUDIT_LOG');

CREATE TABLE "retention_policies" (
    "kind" "RetentionKind" NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "decisionReference" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("kind"),
    CONSTRAINT "retention_policies_period_positive" CHECK ("periodDays" > 0)
);
