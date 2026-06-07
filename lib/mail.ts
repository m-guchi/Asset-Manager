import nodemailer from "nodemailer";

const extractEmail = (value: string) => {
    const match = value.match(/<([^>]+)>/);
    return (match ? match[1] : value).trim();
};

/** Use SMTP_USER as the authoritative sender address (matches Sakura webmail behavior). */
const buildFromAddress = () => {
    const smtpUser = process.env.SMTP_USER;
    const smtpFrom = process.env.SMTP_FROM || "Asset Manager <noreply@example.com>";

    if (!smtpUser) {
        return smtpFrom;
    }

    const userEmail = extractEmail(smtpUser);
    const displayMatch = smtpFrom.match(/^(.+)<[^>]+>$/);
    if (displayMatch) {
        return `${displayMatch[1].trim()} <${userEmail}>`;
    }

    return userEmail;
};

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
    const from = buildFromAddress();

    if (!transporter) {
        console.log("========================================");
        console.log(`[Email Mock] ${options.subject}`);
        console.log(`To: ${options.to}`);
        console.log(`Text: ${options.text}`);
        console.log("========================================");
        return;
    }

    const smtpUser = process.env.SMTP_USER;
    const envelopeFrom = smtpUser ? extractEmail(smtpUser) : extractEmail(from);

    const configuredFrom = process.env.SMTP_FROM;
    if (smtpUser && configuredFrom && extractEmail(configuredFrom) !== extractEmail(smtpUser)) {
        console.warn(
            `SMTP_FROM (${extractEmail(configuredFrom)}) differs from SMTP_USER (${extractEmail(smtpUser)}); ` +
            `using ${extractEmail(from)} as From address.`
        );
    }

    try {
        const info = await transporter.sendMail({
            from,
            to: options.to,
            envelope: {
                from: envelopeFrom,
                to: options.to,
            },
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        console.log(`Email sent to ${options.to}, messageId: ${info.messageId}, response: ${info.response}`);
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
