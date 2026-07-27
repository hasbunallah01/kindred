// Kindred agent runtime entrypoint.
//
// This process is deployed on the VPS under PM2 (see Blueprint Section 12).
// It will eventually boot every BullMQ worker, the Minds SSE listener, and
// all scheduled jobs described in Blueprint Section 10 and 6. For now it
// only proves the process starts and runs under this package's scripts —
// no workers, queues, or external connections are wired up yet.

function main(): void {
  console.log('agent started');
}

main();
