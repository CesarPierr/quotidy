export default function AppLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="app-surface rounded-[2rem] p-5 sm:p-6">
        <div className="shimmer-line h-3 w-24 rounded-full bg-black/8" />
        <div className="shimmer-line mt-3 h-8 w-48 rounded-2xl bg-black/8" />
        <div className="shimmer-line mt-3 h-4 w-72 rounded-full bg-black/6" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-[1.45rem] border border-line bg-white/70 dark:bg-surface/70 p-4">
              <div className="shimmer-line h-3 w-20 rounded-full bg-black/8" />
              <div className="shimmer-line mt-3 h-8 w-16 rounded-xl bg-black/8" />
              <div className="shimmer-line mt-2 h-3 w-24 rounded-full bg-black/6" />
            </div>
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="app-surface rounded-[2rem] p-5 sm:p-6">
        <div className="shimmer-line h-3 w-16 rounded-full bg-black/8" />
        <div className="shimmer-line mt-3 h-6 w-56 rounded-xl bg-black/8" />

        <div className="mt-5 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-white/60 dark:bg-surface/60 p-4">
              <div className="flex items-center gap-3">
                <div className="shimmer-line size-8 rounded-full bg-black/8" />
                <div className="flex-1">
                  <div className="shimmer-line h-4 w-40 rounded-lg bg-black/8" />
                  <div className="shimmer-line mt-2 h-3 w-56 rounded-full bg-black/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
