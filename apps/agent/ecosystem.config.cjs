// PM2 ecosystem configuration for apps/agent — Build Plan Checkpoint 67.
//
// Filename: .cjs (not .js) because apps/agent/package.json declares
// "type": "module". A plain .js ecosystem file would be loaded as ESM
// here, where __dirname doesn't exist and the file would fail at
// require/eval time. PM2 happily consumes .cjs configs the same way,
// and the explicit extension documents the intent for future readers.
//
// One instance, intentionally. The agent hosts a persistent Minds SSE
// listener (apps/agent/src/minds/sse-listener.ts) that holds a single
// long-lived HTTP connection to SubscribeEvents. Duplicating that
// listener would (a) double cognition-usage cost on every Mind event
// and (b) cause every autonomous Insight to be persisted twice. PM2's
// "cluster" mode is the wrong tool here — `instances: 1` and
// `exec_mode: "fork"` is the correct shape, and the SSE listener's
// own reconnection logic (Checkpoint 47) is the right place for
// crash recovery, not a second process competing with the first.

module.exports = {
  apps: [
    {
      name: 'kindred-agent',
      // The repo is deployed to a stable location on the VPS (typically
      // /opt/kindred or the operator's home checkout). PM2 itself runs
      // from the directory it was launched in, so cwd is the canonical
      // way to anchor the agent's working directory regardless of where
      // the operator invoked `pm2 start` from.
      cwd: __dirname,
      // Matches the existing project start command verbatim — see
      // apps/agent/package.json "scripts.start". Keeping it identical
      // means a `npm start` from the operator's shell behaves the same
      // as the PM2-managed process; the only difference is the
      // supervisor wrapping it. The `interpreter: "none"` setting tells
      // PM2 not to wrap script in a node shell, because npm is itself
      // the entry point here.
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      // exec_mode "fork" (the default) + instances: 1 is the explicit,
      // self-documenting way to say "one process." Setting exec_mode
      // without instances: 1 would let a future edit silently fall back
      // to the cluster default, so both are set.
      exec_mode: 'fork',
      instances: 1,
      // Restart on any non-zero exit. PM2's own exponential backoff
      // applies; the application code's own reconnection logic
      // (e.g. SSE listener's reconnect-with-backoff) is what survives
      // transient upstream failures, this is what survives a real crash.
      autorestart: true,
      restart_delay: 1000,
      // Cap the RSS before PM2 force-restarts the process. SSE
      // listeners and BullMQ workers are steady-state; runaway memory
      // here means a leak, not a load spike, and a clean restart is
      // the right response. 512M is generous headroom over a cold
      // start and well below the kind of pressure that would indicate
      // a real leak.
      max_memory_restart: '512M',
      // Logs go to /var/log/pm2/ in production (PM2's default for
      // root-managed installs) so they don't live inside the
      // application directory, where a deploy would wipe them. PM2
      // creates the files; merge_logs keeps adjacent rotated lines
      // grouped, and the timestamp format matches what the rest of
      // the project uses so log-grep is consistent.
      out_file: '/var/log/pm2/kindred-agent.out.log',
      error_file: '/var/log/pm2/kindred-agent.error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Force production NODE_ENV so the agent and its dependencies
      // (e.g. Better Auth's prod-only secret validation, Prisma's
      // query logging) behave correctly on the VPS. The actual
      // secrets (MINDS_BUILDER_API_KEY, REDIS_URL, etc.) are loaded
      // from the process environment — PM2 reads them from the shell
      // that started it, or from a systemd EnvironmentFile on modern
      // setups; this file doesn't duplicate them.
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
