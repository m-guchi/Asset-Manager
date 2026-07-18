-- CreateTable
CREATE TABLE `Index` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `hidden` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `Index_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IndexValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `indexId` INTEGER NOT NULL,
    `value` DOUBLE NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,

    INDEX `IndexValue_indexId_idx`(`indexId`),
    UNIQUE INDEX `IndexValue_indexId_recordedAt_key`(`indexId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
