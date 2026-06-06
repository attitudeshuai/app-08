CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'STUDENT',
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Question` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `options` JSON,
    `answer` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 2,
    `analysis` VARCHAR(191),
    `subject` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Question_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Paper` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191),
    `totalScore` DOUBLE NOT NULL,
    `duration` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Paper_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PaperItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL,
    `questionId` INTEGER NOT NULL,
    `paperId` INTEGER NOT NULL,
    INDEX `PaperItem_paperId_idx`(`paperId`),
    INDEX `PaperItem_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Exam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `paperId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Exam_paperId_idx`(`paperId`),
    INDEX `Exam_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExamRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NOT_STARTED',
    `startTime` DATETIME(3),
    `submitTime` DATETIME(3),
    `totalScore` DOUBLE,
    `answers` JSON,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `examId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    UNIQUE INDEX `ExamRecord_examId_userId_key`(`examId`, `userId`),
    INDEX `ExamRecord_examId_idx`(`examId`),
    INDEX `ExamRecord_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Question` ADD CONSTRAINT `Question_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Paper` ADD CONSTRAINT `Paper_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PaperItem` ADD CONSTRAINT `PaperItem_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `PaperItem` ADD CONSTRAINT `PaperItem_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Exam` ADD CONSTRAINT `Exam_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Exam` ADD CONSTRAINT `Exam_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ExamRecord` ADD CONSTRAINT `ExamRecord_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ExamRecord` ADD CONSTRAINT `ExamRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
