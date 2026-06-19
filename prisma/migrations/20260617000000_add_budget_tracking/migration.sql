-- CreateTable
CREATE TABLE "BudgetIncome" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCharge" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dayOfMonth" INTEGER,
    "savingsBoxId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPocket" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2F6D88',
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "quota" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPocket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetExpense" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "pocketId" TEXT,
    "label" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetIncome_householdId_idx" ON "BudgetIncome"("householdId");

-- CreateIndex
CREATE INDEX "BudgetCharge_householdId_idx" ON "BudgetCharge"("householdId");

-- CreateIndex
CREATE INDEX "BudgetCharge_savingsBoxId_idx" ON "BudgetCharge"("savingsBoxId");

-- CreateIndex
CREATE INDEX "BudgetPocket_householdId_sortOrder_idx" ON "BudgetPocket"("householdId", "sortOrder");

-- CreateIndex
CREATE INDEX "BudgetExpense_householdId_spentAt_idx" ON "BudgetExpense"("householdId", "spentAt");

-- CreateIndex
CREATE INDEX "BudgetExpense_pocketId_idx" ON "BudgetExpense"("pocketId");

-- AddForeignKey
ALTER TABLE "BudgetIncome" ADD CONSTRAINT "BudgetIncome_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCharge" ADD CONSTRAINT "BudgetCharge_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCharge" ADD CONSTRAINT "BudgetCharge_savingsBoxId_fkey" FOREIGN KEY ("savingsBoxId") REFERENCES "SavingsBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPocket" ADD CONSTRAINT "BudgetPocket_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetExpense" ADD CONSTRAINT "BudgetExpense_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetExpense" ADD CONSTRAINT "BudgetExpense_pocketId_fkey" FOREIGN KEY ("pocketId") REFERENCES "BudgetPocket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetExpense" ADD CONSTRAINT "BudgetExpense_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
