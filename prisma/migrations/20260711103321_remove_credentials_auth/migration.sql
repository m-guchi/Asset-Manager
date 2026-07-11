/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `EmailChangeToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PasswordChangeToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PasswordResetToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `password`;

-- DropTable
DROP TABLE `EmailChangeToken`;

-- DropTable
DROP TABLE `PasswordChangeToken`;

-- DropTable
DROP TABLE `PasswordResetToken`;

-- DropTable
DROP TABLE `VerificationToken`;
