-- AlterTable
ALTER TABLE `Exam` ADD COLUMN `monitorEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `maxTabSwitchCount` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `maxIpChangeCount` INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE `ExamRecord` ADD COLUMN `isSuspicious` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `suspiciousReasons` JSON NULL,
    ADD COLUMN `tabSwitchCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `ipChangeCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `ExamRecord_isSuspicious_idx` ON `ExamRecord`(`isSuspicious`);

-- CreateTable
CREATE TABLE `ExamMonitorLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `extraData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `examId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `examRecordId` INTEGER NOT NULL,

    INDEX `ExamMonitorLog_examId_idx`(`examId`),
    INDEX `ExamMonitorLog_userId_idx`(`userId`),
    INDEX `ExamMonitorLog_examRecordId_idx`(`examRecordId`),
    INDEX `ExamMonitorLog_type_idx`(`type`),
    INDEX `ExamMonitorLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExamMonitorLog` ADD CONSTRAINT `ExamMonitorLog_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamMonitorLog` ADD CONSTRAINT `ExamMonitorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamMonitorLog` ADD CONSTRAINT `ExamMonitorLog_examRecordId_fkey` FOREIGN KEY (`examRecordId`) REFERENCES `ExamRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
