import { NextResponse } from 'next/server';
import { sanitizeEnvValue } from '@kindred/minds-client';

// TEMPORARY DIAGNOSTIC ENDPOINT — not part of the app's real feature set.
// Delete this file (apps/web/app/api/test-minds/route.ts) once endpoint
// verification is done.
//
// Updated after a real, confirmed production bug: a live test against
// this endpoint returned "Cannot convert argument to a ByteString
// because the character at index 37 has a value of 8206" (U+200E,
// LEFT-TO-RIGHT MARK) — an invisible Unicode formatting character,
// almost certainly picked up from copying a value off a dashboard "copy"
// button. Deduced which variable: of the three configured Minds env
// vars, only MINDS_BUILDER_API_KEY is placed directly into an HTTP
// header (X-Access-Key) — MINDS_ID goes into the JSON body and
// HELLOMINDS_API_URL goes into the fetch URL, neither of which hits this
// specific ByteString restriction the same way. This route now (1) scans
// every configured value for exactly this class of character and
// reports precisely which one(s) and at what index, for a confirmed
// answer rather than inference alone, and (2) applies the same fix now
// in packages/minds-client/index.ts (sanitizeEnvValue) to the values
// actually used in the retried request below.
//
// The API key's raw value is never logged or returned — only its
// presence/length and any flagged character positions are reported.

interface CharacterIssue {
  index: number;
  codePoint: number;
  hex: string;
  name: string;
}

const KNOWN_INVISIBLE_CHARS: Record<number, string> = {
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE (BOM)',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
};

function findCharacterIssues(value: string): CharacterIssue[] {
  const issues: CharacterIssue[] = [];
  for (let i = 0; i < value.length; i++) {
    const codePoint = value.codePointAt(i);
    if (codePoint === undefined) continue;
    if (codePoint > 255) {
      issues.push({
        index: i,
        codePoint,
        hex: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
        name: KNOWN_INVISIBLE_CHARS[codePoint] ?? '(not a commonly-known invisible mark)',
      });
    }
  }
  return issues;
}

export async function GET() {
  const rawBaseUrl = process.env.HELLOMINDS_API_URL ?? 'https://hellominds.ai';
  const rawAccessKey = process.env.MINDS_BUILDER_API_KEY;
  const rawMindId = process.env.MINDS_ID;

  const diagnostics = {
    HELLOMINDS_API_URL: {
      length: rawBaseUrl.length,
      issues: findCharacterIssues(rawBaseUrl),
    },
    MINDS_BUILDER_API_KEY: rawAccessKey
      ? { length: rawAccessKey.length, issues: findCharacterIssues(rawAccessKey) }
      : 'MISSING',
    MINDS_ID: rawMindId
      ? { length: rawMindId.length, issues: findCharacterIssues(rawMindId) }
      : 'MISSING',
  };

  console.log('[test-minds] Character diagnostics:', diagnostics);

  if (!rawAccessKey) {
    return NextResponse.json(
      { error: 'MINDS_BUILDER_API_KEY is not set in this environment.', diagnostics },
      { status: 500 },
    );
  }
  if (!rawMindId) {
    return NextResponse.json(
      { error: 'MINDS_ID is not set in this environment.', diagnostics },
      { status: 500 },
    );
  }

  // The actual fix, applied here too so this endpoint's retry reflects
  // the same behavior as the real client.
  const accessKey = sanitizeEnvValue(rawAccessKey);
  const mindId = sanitizeEnvValue(rawMindId);
  const baseUrl = sanitizeEnvValue(rawBaseUrl);

  const url = `${baseUrl}/api/messaging/conversations`;
  const requestBody = { mindId };

  console.log('[test-minds] Request (post-sanitization):', {
    method: 'POST',
    url,
    headers: { 'X-Access-Key': '[REDACTED]', 'Content-Type': 'application/json' },
    body: requestBody,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Access-Key': accessKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    let parsedBody: unknown = rawText;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      // Response wasn't JSON — report the raw text instead, still useful
      // for diagnosing (e.g. an HTML error page would show up here).
    }

    console.log('[test-minds] Response:', {
      status: response.status,
      statusText: response.statusText,
      body: parsedBody,
    });

    return NextResponse.json({
      requestUrl: url,
      diagnostics,
      responseStatus: response.status,
      responseStatusText: response.statusText,
      responseBody: parsedBody,
    });
  } catch (error) {
    console.error('[test-minds] Request failed:', error);
    return NextResponse.json(
      {
        requestUrl: url,
        diagnostics,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
