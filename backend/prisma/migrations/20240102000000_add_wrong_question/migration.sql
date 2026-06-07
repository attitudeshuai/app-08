-- CreateTable
CREATE TABLE `WrongQuestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userAnswer` VARCHAR(191) NULL,
    `correctAnswer` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `examId` INTEGER NOT NULL,
    `examRecordId` INTEGER NOT NULL,

    INDEX `WrongQuestion_userId_idx`(`userId`),
    INDEX `WrongQuestion_questionId_idx`(`questionId`),
    INDEX `WrongQuestion_examId_idx`(`examId`),
    INDEX `WrongQuestion_subject_idx`(`subject`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WrongQuestion` ADD CONSTRAINT `WrongQuestion_examRecordId_fkey` FOREIGN KEY (`examRecordId`) REFERENCES `ExamRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
