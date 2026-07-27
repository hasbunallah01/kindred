import { Resend } from 'resend';

// Resend client wrapper for Kindred.
//
// RESEND_API_KEY and EMAIL_FROM come from the environment only — never
// hardcoded here (Blueprint Section 11 / .env.example). Better Auth's
// lifecycle hooks (apps/web/lib/auth.ts) call sendEmail; this file owns
// the actual Resend API call, nothing else.
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error('EMAIL_FROM environment variable is not set.');
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }
}
