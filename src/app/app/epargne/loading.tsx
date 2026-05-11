export default function EpargneLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <section className="app-surface glow-card rounded-[2rem] p-5 sm:p-6">
        <div className="shimmer-line h-3 w-20 rounded-full bg-black/8" />
        <div className="shimmer-line mt-3 h-8 w-40 rounded-2xl bg-black/8" />
        <div className="shimmer-line mt-2 h-4 w-72 rounded-full bg-black/6" />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[1.45rem] border border-line bg-white/70 dark:bg-[#262830]/70 p-4">
              <div className="shimmer-line h-3 w-16 rounded-full bg-black/8" />
              <div className="shimmer-line mt-3 h-7 w-24 rounded-xl bg-black/8" />
            </div>
          ))}
        </div>
      </section>

      {/* Box cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="app-surface rounded-[2rem] p-5">
            <div className="shimmer-line h-5 w-32 rounded-lg bg-black/8" />
            <div className="shimmer-line mt-3 h-8 w-24 rounded-xl bg-black/8" />
            <div className="shimmer-line mt-2 h-3 w-40 rounded-full bg-black/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
