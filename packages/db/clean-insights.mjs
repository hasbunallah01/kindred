// One-off script: prune the demo community's insights to a clean
// state for the dashboard demo. Keeps ONE hero insight and THREE
// list items so the design renders without showing the 30+ that
// accumulated from earlier smoke tests.

import { PrismaClient } from './generated/client/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const community = await prisma.community.findFirst({
    where: { telegramChatId: -1003891430122n },
  });
  if (!community) {
    console.error('No community found');
    process.exit(1);
  }

  const all = await prisma.insight.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Found ${all.length} insights in the demo community`);

  // What we want to keep:
  //   - The most recent "Different shape..." insight (the hero)
  //   - 3 short, varied insights for the list
  const KEEP_CONTENT_SUBSTRINGS = [
    'Different shape from the check-ins',
    'warm welcome',
    'Engagement in the group',
    '3 members haven',
  ];

  // First, mark a chosen insight as autonomous so the dashboard
  // picks it for the hero. The "Different shape" one is the
  // strongest narrative insight, so we use it.
  const heroInsight = all.find((i) => i.content.startsWith('Different shape'));
  if (heroInsight) {
    await prisma.insight.update({
      where: { id: heroInsight.id },
      data: { source: 'autonomous' },
    });
    console.log(`Marked "${heroInsight.content.slice(0, 40)}..." as autonomous (hero)`);
  }

  // Now delete everything except the 4 we want to keep.
  const keepIds = new Set();
  if (heroInsight) keepIds.add(heroInsight.id);
  for (const i of all) {
    if (KEEP_CONTENT_SUBSTRINGS.some((s) => i.content.startsWith(s))) {
      keepIds.add(i.id);
    }
  }

  const toDelete = all.filter((i) => !keepIds.has(i.id));
  console.log(`Keeping ${keepIds.size} insights, deleting ${toDelete.length}`);

  for (const i of toDelete) {
    await prisma.insight.delete({ where: { id: i.id } });
  }
  console.log('Done.');
  console.log();
  console.log('=== Final insight list ===');
  const final = await prisma.insight.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
  });
  for (const i of final) {
    const head = i.content.slice(0, 70).replace(/\n/g, ' ');
    console.log(`  [${i.source}] ${i.createdAt.toISOString().slice(0, 16)} | ${head}...`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
