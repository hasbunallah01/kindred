import { NextResponse } from 'next/server';
import { prisma } from '@kindred/db';

// One-off admin endpoint to prune the demo community's insights
// to a clean state. Idempotent: safe to call multiple times.
//
// Returns JSON summarizing the result. The explicit
// Promise<NextResponse> annotation on POST is required by Next.js
// + Prisma 7 — the inferred return type references a generated
// client type that Next.js can't name for the route registry.

interface CleanResult {
  communityId: string;
  found: number;
  kept: number;
  deleted: number;
  remaining: Array<{
    id: string;
    source: string;
    preview: string;
  }>;
}

export async function POST(): Promise<NextResponse<CleanResult | { error: string }>> {
  const community = await prisma.community.findFirst({
    where: { telegramChatId: -1003891430122n },
  });
  if (!community) {
    return NextResponse.json({ error: 'no community' }, { status: 404 });
  }

  const all = await prisma.insight.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
  });

  // Mark the strongest narrative insight as autonomous so the
  // dashboard picks it for the hero.
  const heroInsight = all.find((i) => i.content.startsWith('Different shape'));
  if (heroInsight) {
    await prisma.insight.update({
      where: { id: heroInsight.id },
      data: { source: 'autonomous' },
    });
  }

  // Keep: the hero + 3 hand-picked list items.
  const KEEP_PREFIXES = [
    'Different shape from the check-ins',
    'warm welcome',
    'Engagement in the group',
    '3 members haven',
  ];
  const keepIds = new Set<string>();
  if (heroInsight) keepIds.add(heroInsight.id);
  for (const i of all) {
    if (KEEP_PREFIXES.some((s) => i.content.startsWith(s))) {
      keepIds.add(i.id);
    }
  }

  const toDelete = all.filter((i) => !keepIds.has(i.id));
  for (const i of toDelete) {
    await prisma.insight.delete({ where: { id: i.id } });
  }

  const final = await prisma.insight.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
  });

  const result: CleanResult = {
    communityId: community.id,
    found: all.length,
    kept: keepIds.size,
    deleted: toDelete.length,
    remaining: final.map((i) => ({
      id: i.id,
      source: i.source,
      preview: i.content.slice(0, 80).replace(/\n/g, ' '),
    })),
  };
  return NextResponse.json(result);
}
