CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organizations_name_not_blank" CHECK (length(btrim("name")) > 0)
);

CREATE UNIQUE INDEX "organizations_name_lower_key" ON "organizations" (lower("name"));

ALTER TABLE "helpers" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "helpers_organizationId_idx" ON "helpers"("organizationId");
ALTER TABLE "helpers" ADD CONSTRAINT "helpers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
