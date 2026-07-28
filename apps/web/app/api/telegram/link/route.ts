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

// Creates a short-lived linking code tied to the signed-in creator
// (Blueprint Section 5.1 step 2). The onboarding flow (Checkpoints 27-28)
// calls this, then the creator posts the code in their Telegram group,
// where the ingest worker (Checkpoint 31) matches it to create the
// Community row.
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

  return NextResponse.json({
    code: linkRequest.code,
    expiresAt: linkRequest.expiresAt,
  });
}
