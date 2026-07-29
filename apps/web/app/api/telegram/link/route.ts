import { randomBytes } from 'crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@kindred/db';

// Unambiguous charset for a code a creator has to read and re-type into
// Telegram: no 0/O or 1/I confusion.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const EXPIRY_MINUTES = 15;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

// Telegram deep-link format the spec calls for in Step 1:
//   https://t.me/<BOT_USERNAME>?start=<secure_link_code>
// The frontend needs the full URL, not just the code, so it can
// `window.open(...)` it without a second round-trip to read
// TELEGRAM_BOT_USERNAME from the public env (which isn't exposed
// client-side — see NEXT_PUBLIC_* convention in .env.example).
function buildBotStartUrl(botUsername: string, code: string): string {
  return `https://t.me/${botUsername}?start=${code}`;
}

// Creates a short-lived linking code tied to the signed-in creator
// (Blueprint Section 5.1 step 2). The onboarding flow (Checkpoints 27-28)
// calls this, then the creator posts the code in their Telegram group,
// where the ingest worker (Checkpoint 31) matches it to create the
// Community row.
//
// As of the Telegram onboarding flow (current feature), the same code is
// also the payload of the /start command the bot receives when the
// creator opens the deep link returned as `botUrl` below — the worker
// matches it against TelegramLinkRequest the same way it does for the
// legacy /link flow. One code, one row, two delivery mechanisms.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  const linkRequest = await prisma.telegramLinkRequest.create({
    data: {
      creatorId: session.user.id,
      code,
      expiresAt,
    },
  });

  // botUrl is what the Connect Telegram button should open. Surfacing
  // the 500 here (rather than 200 with a missing field) keeps the
  // client-side error path simple — there's no real recovery from
  // "the bot isn't configured," so the creator should see the
  // configuration problem at the same moment they're trying to use
  // the feature, not later when the deep link silently fails to open.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_USERNAME is not configured.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    code: linkRequest.code,
    expiresAt: linkRequest.expiresAt,
    botUrl: buildBotStartUrl(botUsername, linkRequest.code),
  });
}
