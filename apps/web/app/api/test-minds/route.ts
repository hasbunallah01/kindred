import { NextResponse } from 'next/server';

// TEMPORARY DIAGNOSTIC ENDPOINT — not part of the app's real feature set.
// Delete this file (apps/web/app/api/test-minds/route.ts) once endpoint
// verification is done. Exists purely because this environment's own
// network access is restricted and cannot reach hellominds.ai directly,
// but Vercel's runtime can — deploying this lets a real, live call happen
// where it's actually possible, then reports back exactly what came back.
//
// Deliberately unauthenticated (no session check) since this is a
// throwaway verification tool, not a real feature — remove it promptly
// once you're done, since it does make a real, live call to the Minds
// API on every request.
//
// The API key is never logged or returned — only its presence/length is
// reported, so you can confirm it's actually configured without ever
// exposing the value itself anywhere (console, response body, or
// Vercel's Runtime Logs).

export async function GET() {
  const baseUrl = process.env.HELLOMINDS_API_URL ?? 'https://hellominds.ai';
  const accessKey = process.env.MINDS_BUILDER_API_KEY;
  const mindId = process.env.MINDS_ID;

  const envCheck = {
    HELLOMINDS_API_URL: baseUrl,
    MINDS_BUILDER_API_KEY: accessKey ? `present (${accessKey.length} chars)` : 'MISSING',
    MINDS_ID: mindId ?? 'MISSING',
  };

  console.log('[test-minds] Environment check:', envCheck);

  if (!accessKey) {
    return NextResponse.json(
      { error: 'MINDS_BUILDER_API_KEY is not set in this environment.', envCheck },
      { status: 500 },
    );
  }
  if (!mindId) {
    return NextResponse.json(
      { error: 'MINDS_ID is not set in this environment.', envCheck },
      { status: 500 },
    );
  }

  const url = `${baseUrl}/api/messaging/conversations`;
  const requestBody = { mindId };

  console.log('[test-minds] Request:', {
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
      envCheck,
      responseStatus: response.status,
      responseStatusText: response.statusText,
      responseBody: parsedBody,
    });
  } catch (error) {
    console.error('[test-minds] Request failed:', error);
    return NextResponse.json(
      {
        requestUrl: url,
        envCheck,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
