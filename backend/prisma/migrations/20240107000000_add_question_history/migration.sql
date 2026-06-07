-- CreateTable
CREATE TABLE `QuestionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `options` JSON NULL,
    `answer` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 2,
    `analysis` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `version` INTEGER NOT NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifiedById` INTEGER NOT NULL,

    UNIQUE INDEX `QuestionHistory_questionId_version_key`(`questionId`, `version`),
    INDEX `QuestionHistory_questionId_idx`(`questionId`),
    INDEX `QuestionHistory_modifiedById_idx`(`modifiedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuestionHistory` ADD CONSTRAINT `QuestionHistory_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionHistory` ADD CONSTRAINT `QuestionHistory_modifiedById_fkey` FOREIGN KEY (`modifiedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
