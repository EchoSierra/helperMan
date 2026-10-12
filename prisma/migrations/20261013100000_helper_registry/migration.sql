-- Add isolated helper registry tables. Legacy users/qualifications are preserved
-- until their contents are inventoried and an explicit mapping is approved.
CREATE TABLE "helpers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "helpers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "helper_qualifications" (
    "id" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "validThrough" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "helper_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "helpers_lastName_firstName_id_idx" ON "helpers"("lastName", "firstName", "id");
CREATE INDEX "helpers_firstName_lastName_id_idx" ON "helpers"("firstName", "lastName", "id");
CREATE INDEX "helper_qualifications_helperId_idx" ON "helper_qualifications"("helperId");
CREATE INDEX "helper_qualifications_validThrough_idx" ON "helper_qualifications"("validThrough");

ALTER TABLE "helper_qualifications"
    ADD CONSTRAINT "helper_qualifications_helperId_fkey"
    FOREIGN KEY ("helperId") REFERENCES "helpers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
