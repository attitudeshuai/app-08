-- CreateTable
CREATE TABLE `PaperTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `totalScore` DOUBLE NOT NULL,
    `duration` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `createdById` INTEGER NOT NULL,

    INDEX `PaperTemplate_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaperTemplateItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sortOrder` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL,
    `questionId` INTEGER NOT NULL,
    `templateId` INTEGER NOT NULL,

    INDEX `PaperTemplateItem_templateId_idx`(`templateId`),
    INDEX `PaperTemplateItem_questionId_idx`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaperTemplate` ADD CONSTRAINT `PaperTemplate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperTemplateItem` ADD CONSTRAINT `PaperTemplateItem_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaperTemplateItem` ADD CONSTRAINT `PaperTemplateItem_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `PaperTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
