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
// button. Deduced which variable: of the configured Minds env vars,
// only MINDS_BUILDER_API_KEY is placed directly into an HTTP header
// (X-Api-Key) — MINDS_ID goes into the JSON body, which doesn't hit
// this specific ByteString restriction the same way. This route now
// (1) scans every configured value for exactly this class of character
// and reports precisely which one(s) and at what index, for a confirmed
// answer rather than inference alone, and (2) applies the same fix now
// in packages/minds-client/index.ts (sanitizeEnvValue) to the values
// actually used in the retried request below.
//
// The API key's raw value is never logged or returned — only its
// presence/length and any flagged character positions are reported.
//
// Verification flow (Checkpoint 51+): runs CreateConversation, then
// SendMessage, then GetMessageHistory against the official Builder API
// in a single GET. Returns the upstream response for each step
// individually so any failure can be diagnosed from the JSON.

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

const BASE_URL = 'https://api.build.hellominds.ai';
const VERIFICATION_MESSAGE = 'verification test';

async function callBuilderApi(args: {
  method: 'POST' | 'GET';
  path: string;
  apiKey: string;
  body?: unknown;
}): Promise<{ status: number; statusText: string; body: unknown; rawText: string }> {
  const url = `${BASE_URL}${args.path}`;
  const headers: Record<string, string> = {
    'X-Api-Key': args.apiKey,
    'Content-Type': 'application/json',
  };

  const init: RequestInit = {
    method: args.method,
    headers,
  };
  if (args.body !== undefined) {
    init.body = JSON.stringify(args.body);
  }

  const response = await fetch(url, init);
  const rawText = await response.text();
  let parsedBody: unknown = rawText;
  try {
    parsedBody = JSON.parse(rawText);
  } catch {
    // Not JSON — report raw text.
  }
  return {
    status: response.status,
    statusText: response.statusText,
    body: parsedBody,
    rawText,
  };
}

export async function GET() {
  const rawApiKey = process.env.MINDS_BUILDER_API_KEY;
  const rawMindId = process.env.MINDS_ID;

  const diagnostics = {
    MINDS_BUILDER_API_KEY: rawApiKey
      ? { length: rawApiKey.length, issues: findCharacterIssues(rawApiKey) }
      : 'MISSING',
    MINDS_ID: rawMindId
      ? { length: rawMindId.length, issues: findCharacterIssues(rawMindId) }
      : 'MISSING',
  };

  console.log('[test-minds] Character diagnostics:', diagnostics);

  if (!rawApiKey) {
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

  const apiKey = sanitizeEnvValue(rawApiKey);
  const mindId = sanitizeEnvValue(rawMindId);

  // Step 1: CreateConversation. Fresh alias per call so re-runs are
  // independent (the Checkpoint 50 alias is stale now).
  const createAlias = crypto.randomUUID();
  let createResult;
  try {
    createResult = await callBuilderApi({
      method: 'POST',
      path: '/v1/messaging/conversation',
      apiKey,
      body: { alias: createAlias, mindId },
    });
  } catch (error) {
    return NextResponse.json(
      { step: 'createConversation', error: error instanceof Error ? error.message : 'Unknown error', diagnostics },
      { status: 502 },
    );
  }

  // Use the alias returned by the API if present, otherwise the one we sent.
  const alias: string | undefined =
    createResult.body && typeof createResult.body === 'object' && 'alias' in createResult.body
      ? ((createResult.body as { alias?: string }).alias ?? createAlias)
      : createAlias;

  // Step 2: SendMessage. Skip if Step 1 didn't return 2xx.
  let sendResult: Awaited<ReturnType<typeof callBuilderApi>> | null = null;
  if (createResult.status >= 200 && createResult.status < 300) {
    try {
      sendResult = await callBuilderApi({
        method: 'POST',
        path: '/v1/messaging/message',
        apiKey,
        body: { alias, messageText: VERIFICATION_MESSAGE },
      });
    } catch (error) {
      sendResult = {
        status: 0,
        statusText: 'NETWORK_ERROR',
        body: error instanceof Error ? error.message : 'Unknown error',
        rawText: '',
      };
    }
  }

  // Step 3: GetMessageHistory. Skip if Step 2 didn't return 2xx (no
  // point reading history if no message was sent).
  let historyResult: Awaited<ReturnType<typeof callBuilderApi>> | null = null;
  if (sendResult && sendResult.status >= 200 && sendResult.status < 300) {
    try {
      historyResult = await callBuilderApi({
        method: 'GET',
        path: `/v1/messaging/histories/${encodeURIComponent(alias)}`,
        apiKey,
      });
    } catch (error) {
      historyResult = {
        status: 0,
        statusText: 'NETWORK_ERROR',
        body: error instanceof Error ? error.message : 'Unknown error',
        rawText: '',
      };
    }
  }

  return NextResponse.json({
    diagnostics,
    baseUrl: BASE_URL,
    steps: {
      createConversation: {
        request: { method: 'POST', path: '/v1/messaging/conversation', body: { alias: createAlias, mindId } },
        response: createResult,
        alias,
      },
      sendMessage: sendResult
        ? {
            request: { method: 'POST', path: '/v1/messaging/message', body: { alias, messageText: VERIFICATION_MESSAGE } },
            response: sendResult,
          }
        : { skipped: true, reason: 'createConversation did not return 2xx' },
      getMessageHistory: historyResult
        ? {
            request: { method: 'GET', path: `/v1/messaging/histories/${alias}` },
            response: historyResult,
          }
        : { skipped: true, reason: 'sendMessage did not return 2xx' },
    },
    note:
      'SSE (/v1/messaging/events) is intentionally not exercised here: ' +
      'a Vercel serverless GET cannot hold a long-lived SSE connection ' +
      'and return a JSON response. The SSE listener in ' +
      'apps/agent/src/minds/sse-listener.ts is verified by build + ' +
      'type-check only until the agent worker can be observed live.',
  });
}
