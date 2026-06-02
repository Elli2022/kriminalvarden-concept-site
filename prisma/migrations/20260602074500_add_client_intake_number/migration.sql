ALTER TABLE "Client" ADD COLUMN "intakeNumber" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "Client_intakeNumber_key" ON "Client"("intakeNumber");
