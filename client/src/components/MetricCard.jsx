export function MetricCard({ icon: Icon, label, value, detail, tone = "cyan" }) {
  const tones = {
    cyan: "from-cyan-400/25 to-blue-500/5 text-cyan-200 ring-cyan-300/20",
    emerald: "from-emerald-400/25 to-teal-500/5 text-emerald-200 ring-emerald-300/20",
    rose: "from-rose-400/25 to-pink-500/5 text-rose-200 ring-rose-300/20",
    amber: "from-amber-400/25 to-orange-500/5 text-amber-200 ring-amber-300/20",
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
          {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
        </div>
        <div className={`rounded-2xl bg-gradient-to-br p-3 ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}
