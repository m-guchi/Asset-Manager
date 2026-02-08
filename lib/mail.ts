import nodemailer from "nodemailer";

const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        console.warn("SMTP settings are missing. Emails will be logged to console instead of sent.");
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass,
        },
    });
};

const sendMail = async (options: { to: string; subject: string; html: string; text: string }) => {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || "Asset Manager <noreply@example.com>";

    if (!transporter) {
        console.log("========================================");
        console.log(`[Email Mock] ${options.subject}`);
        console.log(`To: ${options.to}`);
        console.log(`Text: ${options.text}`);
        console.log("========================================");
        return;
    }

    try {
        await transporter.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
    } catch (error) {
        console.error("Failed to send email:", error);
        throw new Error("メールの送信に失敗しました");
    }
};

export const sendVerificationEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmLink = `${baseUrl}/auth/verify?token=${token}`;

    await sendMail({
        to: email,
        subject: "メールアドレスの確認",
        html: `<p>以下のリンクをクリックしてメールアドレスを認証してください：</p><p><a href="${confirmLink}">${confirmLink}</a></p>`,
        text: `以下のリンクをクリックしてメールアドレスを認証してください：\n${confirmLink}`,
    });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    await sendMail({
        to: email,
        subject: "パスワードのリセット",
        html: `<p>以下のリンクをクリックしてパスワードをリセットしてください：</p><p><a href="${resetLink}">${resetLink}</a></p>`,
        text: `以下のリンクをクリックしてパスワードをリセットしてください：\n${resetLink}`,
    });
};

export const sendEmailChangeVerificationEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmLink = `${baseUrl}/auth/confirm-email-change?token=${token}`;

    await sendMail({
        to: email,
        subject: "新しいメールアドレスの確認",
        html: `<p>以下のリンクをクリックして新しいメールアドレスを認証してください：</p><p><a href="${confirmLink}">${confirmLink}</a></p>`,
        text: `以下のリンクをクリックして新しいメールアドレスを認証してください：\n${confirmLink}`,
    });
};

export const sendEmailChangeNotificationEmail = async (email: string, newEmail: string) => {
    await sendMail({
        to: email,
        subject: "メールアドレス変更のお知らせ",
        html: `<p>あなたのメールアドレスが ${newEmail} に変更されました。</p>`,
        text: `あなたのメールアドレスが ${newEmail} に変更されました。`,
    });
};

export const sendPasswordChangeVerificationEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmLink = `${baseUrl}/auth/confirm-password-change?token=${token}`;

    await sendMail({
        to: email,
        subject: "パスワード変更の確認",
        html: `<p>以下のリンクをクリックしてパスワードの変更を承認してください：</p><p><a href="${confirmLink}">${confirmLink}</a></p>`,
        text: `以下のリンクをクリックしてパスワードの変更を承認してください：\n${confirmLink}`,
    });
};
