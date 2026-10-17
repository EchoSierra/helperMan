CREATE TABLE "qualification_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "qualification_definitions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "qualification_definitions_name_not_blank" CHECK (length(btrim("name")) > 0)
);

INSERT INTO "qualification_definitions" ("id", "name", "createdAt", "updatedAt")
SELECT md5('qualification:' || lower(btrim("title"))), min(btrim("title")), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "helper_qualifications"
GROUP BY lower(btrim("title"));

CREATE UNIQUE INDEX "qualification_definitions_name_lower_key"
    ON "qualification_definitions" (lower("name"));

ALTER TABLE "helper_qualifications" ADD COLUMN "definitionId" TEXT;
UPDATE "helper_qualifications"
SET "definitionId" = md5('qualification:' || lower(btrim("title")));
ALTER TABLE "helper_qualifications" ALTER COLUMN "definitionId" SET NOT NULL;
ALTER TABLE "helper_qualifications" DROP COLUMN "title";
ALTER TABLE "helper_qualifications" ADD CONSTRAINT "helper_qualifications_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "qualification_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "helper_qualifications_definitionId_idx" ON "helper_qualifications"("definitionId");
CREATE UNIQUE INDEX "helper_qualifications_helperId_definitionId_key"
    ON "helper_qualifications"("helperId", "definitionId");

CREATE TABLE "equipment_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "equipment_types_name_not_blank" CHECK (length(btrim("name")) > 0)
);
CREATE UNIQUE INDEX "equipment_types_name_lower_key" ON "equipment_types" (lower("name"));

CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED');

CREATE TABLE "equipment_items" (
    "id" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "assetLabel" TEXT,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "equipment_items_equipmentTypeId_fkey"
        FOREIGN KEY ("equipmentTypeId") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "equipment_items_equipmentTypeId_status_idx" ON "equipment_items"("equipmentTypeId", "status");

CREATE TABLE "equipment_assignments" (
    "id" TEXT NOT NULL,
    "equipmentItemId" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMPTZ(3),
    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "equipment_assignments_equipmentItemId_fkey"
        FOREIGN KEY ("equipmentItemId") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "equipment_assignments_helperId_fkey"
        FOREIGN KEY ("helperId") REFERENCES "helpers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "equipment_assignments_one_current_per_item"
    ON "equipment_assignments"("equipmentItemId") WHERE "returnedAt" IS NULL;
CREATE INDEX "equipment_assignments_helperId_returnedAt_idx" ON "equipment_assignments"("helperId", "returnedAt");
CREATE INDEX "equipment_assignments_equipmentItemId_returnedAt_idx" ON "equipment_assignments"("equipmentItemId", "returnedAt");
