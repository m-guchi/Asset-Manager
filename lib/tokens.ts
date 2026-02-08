
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";

export const generateVerificationToken = async (email: string) => {
    const token = uuidv4();
    // トークンの有効期限を1時間に設定
    const expires = new Date(new Date().getTime() + 3600 * 1000);

    // 既存のトークンがあれば全て削除（常に最新のものだけ有効にする）
    const existingToken = await prisma.verificationToken.findFirst({
        where: { identifier: email }
    });

    if (existingToken) {
        await prisma.verificationToken.deleteMany({
            where: { identifier: email }
        });
    }

    const verificationToken = await prisma.verificationToken.create({
        data: {
            identifier: email,
            token,
            expires,
        }
    });

    return verificationToken;
};

export const generatePasswordResetToken = async (email: string) => {
    const token = uuidv4();
    // トークンの有効期限を15分に設定
    const expires = new Date(new Date().getTime() + 15 * 60 * 1000);

    const existingToken = await prisma.passwordResetToken.findFirst({
        where: { identifier: email }
    });

    if (existingToken) {
        await prisma.passwordResetToken.deleteMany({
            where: { identifier: email }
        });
    }

    const passwordResetToken = await prisma.passwordResetToken.create({
        data: {
            identifier: email,
            token,
            expires,
        }
    });

    return passwordResetToken;
};

export const generateEmailChangeToken = async (email: string, newEmail: string) => {
    const token = uuidv4();
    const expires = new Date(new Date().getTime() + 15 * 60 * 1000);

    const existingToken = await prisma.emailChangeToken.findFirst({
        where: { identifier: email }
    });

    if (existingToken) {
        await prisma.emailChangeToken.deleteMany({
            where: { identifier: email }
        });
    }

    const emailChangeToken = await prisma.emailChangeToken.create({
        data: {
            identifier: email,
            newEmail,
            token,
            expires,
        }
    });

    return emailChangeToken;
};

export const generatePasswordChangeToken = async (email: string, hashedNewPassword: string) => {
    const token = uuidv4();
    const expires = new Date(new Date().getTime() + 15 * 60 * 1000);

    const existingToken = await prisma.passwordChangeToken.findFirst({
        where: { identifier: email }
    });

    if (existingToken) {
        await prisma.passwordChangeToken.deleteMany({
            where: { identifier: email }
        });
    }

    const passwordChangeToken = await prisma.passwordChangeToken.create({
        data: {
            identifier: email,
            newPassword: hashedNewPassword,
            token,
            expires,
        }
    });

    return passwordChangeToken;
};
