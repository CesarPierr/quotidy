export default function FoyerLoading() {
  return (
    <div className="space-y-4">
      {/* Moi / Foyer switch placeholder */}
      <div className="flex justify-center sm:justify-start">
        <div className="shimmer-line h-10 w-44 rounded-full bg-black/8" />
      </div>

      {/* Header skeleton */}
      <div className="app-surface rounded-[1.35rem] p-3.5 sm:rounded-[1.6rem] sm:p-4">
        <div className="shimmer-line h-3 w-28 rounded-full bg-black/8" />
        <div className="shimmer-line mt-2 h-7 w-48 rounded-2xl bg-black/8" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="shimmer-line h-9 w-full rounded-full bg-black/8" />
          <div className="shimmer-line h-9 w-full rounded-full bg-black/8" />
        </div>
      </div>

      {/* Task list skeleton */}
      <div className="app-surface rounded-[2rem] p-5 sm:p-6 space-y-3">
        <div className="shimmer-line h-3 w-16 rounded-full bg-black/8" />
        <div className="shimmer-line h-6 w-40 rounded-xl bg-black/8" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white/60 dark:bg-[#262830]/60 p-4">
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
  );
}
