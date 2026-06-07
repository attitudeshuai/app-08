-- AlterTable
ALTER TABLE `ExamRecord` ADD COLUMN `totalActiveTime` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `ExamRecord` ADD COLUMN `enterCount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `ExamSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enterTime` DATETIME(3) NOT NULL,
    `exitTime` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `examRecordId` INTEGER NOT NULL,
    `examId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `ExamSession_examId_idx`(`examId`),
    INDEX `ExamSession_userId_idx`(`userId`),
    INDEX `ExamSession_examRecordId_idx`(`examRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_examRecordId_fkey` FOREIGN KEY (`examRecordId`) REFERENCES `ExamRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
