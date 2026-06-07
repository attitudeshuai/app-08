-- AlterTable
ALTER TABLE `Exam` ADD COLUMN `autoSubmit` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `ExamRecord` ADD COLUMN `isAutoSubmitted` BOOLEAN NOT NULL DEFAULT false;
