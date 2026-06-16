export default function AideMemoireLoading() {
  return (
    <section className="space-y-6">
      <div className="px-1">
        <div className="shimmer-line h-9 w-48 rounded-xl bg-black/[0.06]" />
        <div className="shimmer-line mt-2 h-4 w-72 rounded bg-black/[0.05]" />
      </div>
      {[0, 1].map((i) => (
        <div className="app-surface rounded-[2rem] p-5 sm:p-6" key={i}>
          <div className="shimmer-line h-6 w-40 rounded bg-black/[0.06]" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((j) => (
              <div className="shimmer-line h-12 w-full rounded-2xl bg-black/[0.05]" key={j} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
