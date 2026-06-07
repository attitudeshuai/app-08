-- CreateTable
CREATE TABLE `QuestionDiscussion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `questionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,

    INDEX `QuestionDiscussion_questionId_idx`(`questionId`),
    INDEX `QuestionDiscussion_userId_idx`(`userId`),
    INDEX `QuestionDiscussion_parentId_idx`(`parentId`),
    INDEX `QuestionDiscussion_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionDiscussionLike` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `discussionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `QuestionDiscussionLike_discussionId_userId_key`(`discussionId`, `userId`),
    INDEX `QuestionDiscussionLike_discussionId_idx`(`discussionId`),
    INDEX `QuestionDiscussionLike_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuestionDiscussion` ADD CONSTRAINT `QuestionDiscussion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionDiscussion` ADD CONSTRAINT `QuestionDiscussion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionDiscussion` ADD CONSTRAINT `QuestionDiscussion_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `QuestionDiscussion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionDiscussionLike` ADD CONSTRAINT `QuestionDiscussionLike_discussionId_fkey` FOREIGN KEY (`discussionId`) REFERENCES `QuestionDiscussion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionDiscussionLike` ADD CONSTRAINT `QuestionDiscussionLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
