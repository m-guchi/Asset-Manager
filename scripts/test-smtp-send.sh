#!/usr/bin/env bash
# Send a test email via SMTP settings from 1Password.
# Usage: npm run test:smtp -- recipient@example.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${1:-}" ]]; then
  echo "Usage: npm run test:smtp -- <recipient@example.com>" >&2
  exit 1
fi

TO_EMAIL="$1"

op run --env-file=.env.1password.tpl -- node -e "
const nodemailer = require('nodemailer');

const extractEmail = (value) => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim();
};

const to = process.argv[1];
const smtpUser = process.env.SMTP_USER || '';
const smtpFrom = process.env.SMTP_FROM || '';
const userEmail = extractEmail(smtpUser);
const displayMatch = smtpFrom.match(/^(.+)<[^>]+>$/);
const fromHeader = userEmail
  ? (displayMatch ? displayMatch[1].trim() + ' <' + userEmail + '>' : userEmail)
  : smtpFrom;
const envelopeFrom = userEmail || extractEmail(smtpFrom);

console.log('--- SMTP diagnostics ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST || '(unset)');
console.log('SMTP_PORT:', process.env.SMTP_PORT || '587');
console.log('SMTP_USER:', userEmail || '(unset)');
console.log('SMTP_FROM:', smtpFrom || '(unset)');
if (userEmail && smtpFrom && extractEmail(smtpFrom) !== userEmail) {
  console.warn('⚠️  SMTP_FROM address differs from SMTP_USER; From header uses SMTP_USER');
}
console.log('From header:', fromHeader);
console.log('Envelope-From:', envelopeFrom);
console.log('To:', to);
console.log('------------------------');

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

t.sendMail({
  from: fromHeader,
  to,
  envelope: { from: envelopeFrom, to },
  subject: 'テスト送信（Asset Manager）',
  text: 'SMTP設定の受信テストです。',
})
.then((info) => {
  console.log('✅ messageId:', info.messageId);
  console.log('✅ response:', info.response);
  console.log('');
  console.log('250 accepted = Sakura queued the mail. If not received:');
  console.log('  1. Check spam folder');
  console.log('  2. Check Sakura webmail for', userEmail, '(bounces)');
  console.log('  3. Try sending to app@gucchii.com (same domain)');
  console.log('  4. Send from Sakura webmail to Gmail — if that fails too, contact Sakura support');
})
.catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
" "$TO_EMAIL"
