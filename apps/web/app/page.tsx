export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Kindred
      </h1>
      <p className="max-w-md text-base text-neutral-400 sm:text-lg">
        Never let a loyal fan become a forgotten fan.
      </p>
      <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs uppercase tracking-wider text-neutral-500">
        Coming soon
      </span>
    </main>
  );
}
