
export const sendVerificationEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const confirmLink = `${baseUrl}/auth/verify?token=${token}`;

    console.log("========================================");
    console.log(`[Email Mock] Verification Email`);
    console.log(`To: ${email}`);
    console.log(`Subject: Confirm your email`);
    console.log(`Click here to verify email: ${confirmLink}`);
    console.log("========================================");

    // 将来的にはResendやNodemailerなどに置き換える
    // await resend.emails.send({ ... })
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    console.log("========================================");
    console.log(`[Email Mock] Password Reset Email`);
    console.log(`To: ${email}`);
    console.log(`Subject: Reset your password`);
    console.log(`Click here to reset password: ${resetLink}`);
    console.log("========================================");
};
