// Kindred Mind — transactional email templates.
//
// All transactional emails sent by Better Auth (currently:
// email-verification OTP and password-reset OTP) flow through this
// file. The visual template is shared between the two — only the
// heading, intro copy, preheader, and security notice differ. The OTP
// is the visual centre of every email and is rendered inside a
// rounded card with a large monospace primary-purple code.
//
// Design tokens (locked to the Kindred Mind Design Foundation, see
// docs/DESIGN_FOUNDATION.md):
//   page bg          #F5F5F7   (very light cool gray, Linear-style)
//   card bg          #FFFFFF
//   heading          #111827
//   body text        #374151
//   muted text       #9CA3AF
//   brand purple     #5B3CC4   (primary accent — used for links, the
//                               OTP text, and the subtle OTP card tint)
//   OTP card bg      #F4F1FC   (very light purple, ~5% of brand)
//   OTP card border  #E5DCFA
//   coral            #FF7A6B   (NOT used in the current templates —
//                               reserved for future emphasis-only
//                               use cases per the design system)
//
// HTML email best practices baked in:
//   - table-based layout (Outlook + older clients don't honour flex/grid)
//   - all visual styles inlined (most clients strip <style> blocks)
//   - 600px max-width card, mobile-friendly via responsive padding
//   - Inter / system-ui font stack (no @import — most clients block it)
//   - monospace font stack for the OTP code (SF Mono / Monaco / Consolas)
//   - preheader text (hidden, shown in inbox preview pane)
//
// The siteUrl / logoUrl are derived from NEXT_PUBLIC_APP_URL with a
// safe fallback. Email clients need absolute, publicly-reachable URLs —
// relative paths or local file paths don't render in inboxes.

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://kindred.haybee.xyz';
const LOGO_URL = `${SITE_URL}/brand/kindred-logo-email.png`;
const SITE_DISPLAY = SITE_URL.replace(/^https?:\/\//, '');

interface OtpEmailParams {
  /** Big <h1> copy, e.g. "Verify your email" */
  heading: string;
  /** One-line intro paragraph under the heading */
  intro: string;
  /** Hidden preheader text shown in the inbox preview pane */
  preheader: string;
  /** The 6-digit code (or however long Better Auth generates) */
  otp: string;
  /** The "If you didn't request this..." notice — type-specific copy */
  securityNote: string;
}

// Shared body of every transactional email. The subject is built by
// the caller via buildVerificationOtpEmail / buildPasswordResetOtpEmail
// so the wiring point at apps/web/lib/auth.ts stays declarative.
function buildOtpEmail(params: OtpEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${params.heading} — Kindred Mind</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #374151;">

  <!-- Preheader (hidden in the email body, shown in inbox preview pane) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #F5F5F7; opacity: 0;">
    ${params.preheader}
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F5F5F7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <!-- Main card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 1px 2px rgba(17, 24, 39, 0.04), 0 8px 24px rgba(17, 24, 39, 0.04); overflow: hidden;">

          <!-- Header: Kindred Mind wordmark -->
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px;">
              <img
                src="${LOGO_URL}"
                alt="Kindred Mind"
                width="180"
                style="display: block; width: 180px; max-width: 180px; height: auto; border: 0; outline: none; text-decoration: none;"
              />
            </td>
          </tr>

          <!-- Heading + intro -->
          <tr>
            <td style="padding: 16px 48px 8px 48px;">
              <h1 style="margin: 0 0 12px 0; font-family: inherit; font-size: 24px; font-weight: 600; line-height: 32px; color: #111827; letter-spacing: -0.02em;">
                ${params.heading}
              </h1>
              <p style="margin: 0; font-family: inherit; font-size: 16px; line-height: 24px; color: #6B7280;">
                ${params.intro}
              </p>
            </td>
          </tr>

          <!-- OTP card -->
          <tr>
            <td align="center" style="padding: 24px 32px 8px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F4F1FC; border: 1px solid #E5DCFA; border-radius: 12px;">
                <tr>
                  <td align="center" style="padding: 28px 16px;">
                    <div style="font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #5B3CC4; letter-spacing: 0.25em; line-height: 1;">
                      ${params.otp}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry notice -->
          <tr>
            <td align="center" style="padding: 16px 48px 0 48px;">
              <p style="margin: 0; font-family: inherit; font-size: 14px; line-height: 20px; color: #6B7280;">
                This code expires in <strong style="color: #111827; font-weight: 600;">5 minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding: 32px 48px 40px 48px;">
              <p style="margin: 0; font-family: inherit; font-size: 13px; line-height: 20px; color: #9CA3AF; text-align: center;">
                ${params.securityNote}
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer (outside the card, sits on the page background) -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 32px 20px 0 20px;">
              <p style="margin: 0; font-family: inherit; font-size: 14px; font-weight: 600; line-height: 20px; color: #111827;">
                Kindred Mind
              </p>
              <p style="margin: 4px 0 0 0; font-family: inherit; font-size: 13px; line-height: 18px; color: #6B7280;">
                AI Relationship Memory for Telegram Communities
              </p>
              <p style="margin: 10px 0 0 0; font-family: inherit; font-size: 13px; line-height: 18px;">
                <a href="${SITE_URL}" style="color: #5B3CC4; text-decoration: none; font-weight: 500;">${SITE_DISPLAY}</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Email sent immediately after sign-up to confirm the user's email
// address. Triggered by Better Auth's emailOTP plugin (with
// `sendVerificationOnSignUp: true`).
export function buildVerificationOtpEmail(otp: string): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Verify your email — Kindred Mind',
    html: buildOtpEmail({
      heading: 'Verify your email',
      intro:
        'Use this code to confirm your email address and finish setting up your Kindred Mind account. The code is single-use and only valid for a few minutes.',
      preheader: `${otp} is your Kindred Mind verification code`,
      otp,
      securityNote:
        "If you didn't request this code, you can safely ignore this email. Someone may have typed your email address by mistake, and no account has been created on your behalf.",
    }),
  };
}

// Email sent when the user requests a password reset (the
// `/reset-password` page calls `authClient.emailOtp.requestPasswordReset`,
// which routes through the same emailOTP plugin under the hood).
export function buildPasswordResetOtpEmail(otp: string): {
  subject: string;
  html: string;
} {
  return {
    subject: 'Reset your password — Kindred Mind',
    html: buildOtpEmail({
      heading: 'Reset your password',
      intro:
        "Use this code to reset your Kindred Mind password. If you didn't request a reset, you can safely ignore this email and your password will stay the same.",
      preheader: `${otp} is your Kindred Mind password reset code`,
      otp,
      securityNote:
        "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and no one else has access to your account.",
    }),
  };
}
