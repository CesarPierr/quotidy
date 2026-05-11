-- AlterEnum
ALTER TYPE "SavingsCalculatorResultMode" ADD VALUE 'none';

-- AlterTable
ALTER TABLE "SavingsCalculatorRun" ALTER COLUMN "boxId" DROP NOT NULL;
