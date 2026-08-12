import { NextResponse } from 'next/server';
import { prisma } from '@kindred/db';

// One-off admin endpoint to seed short, varied demo insights for
// the "Recent insights" list so the dashboard renders a complete
// story. Idempotent: deletes the seeded insights first, then
// re-creates them. The hero ("Different shape...") is left alone.

interface DemoInsight {
  content: string;
  source: 'reactive' | 'autonomous';
  minutesAgo: number;
}

const DEMO_INSIGHTS: DemoInsight[] = [
  {
    content:
      'Engagement in the group increased 18% this week. Most of the lift is coming from a handful of returning members who re-engaged after a quiet stretch.',
    source: 'autonomous',
    minutesAgo: 65,
  },
  {
    content:
      '3 members haven\'t been active for a while. Kindred can help you reach out.',
    source: 'autonomous',
    minutesAgo: 60 * 6,
  },
];

export async function POST(): Promise<NextResponse> {
  const community = await prisma.community.findFirst({
    where: { telegramChatId: -1003891430122n },
  });
  if (!community) {
    return NextResponse.json({ error: 'no community' }, { status: 404 });
  }

  // Delete any existing demo insights (the seed content prefixes
  // are the IDs we use for clean re-seeding).
  const existing = await prisma.insight.findMany({
    where: {
      communityId: community.id,
      content: { startsWith: 'Engagement in the group' },
    },
  });
  for (const e of existing) {
    await prisma.insight.delete({ where: { id: e.id } });
  }
  const existing2 = await prisma.insight.findMany({
    where: {
      communityId: community.id,
      content: { startsWith: '3 members haven' },
    },
  });
  for (const e of existing2) {
    await prisma.insight.delete({ where: { id: e.id } });
  }

  const now = Date.now();
  for (const d of DEMO_INSIGHTS) {
    const createdAt = new Date(now - d.minutesAgo * 60 * 1000);
    await prisma.insight.create({
      data: {
        communityId: community.id,
        content: d.content,
        source: d.source,
        createdAt,
      },
    });
  }

  const final = await prisma.insight.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({
    seeded: DEMO_INSIGHTS.length,
    remaining: final.length,
    items: final.map((i) => ({
      source: i.source,
      minutesAgo: Math.round((now - i.createdAt.getTime()) / 60000),
      preview: i.content.slice(0, 80).replace(/\n/g, ' '),
    })),
  });
}
