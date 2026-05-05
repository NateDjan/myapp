import { Clock, DollarSign, TrendingDown, Users } from "lucide-react";
import { formatCurrency, formatDuration } from "../lib/format";

export function OverlayPanel({ meeting, snapshot, onValidateDeparture }) {
  if (!meeting || !snapshot) {
    return (
      <div className="min-h-screen w-full bg-slate-950 p-3 text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          Aucune reunion active.
        </div>
      </div>
    );
  }

  const topSuggestion = snapshot.suggestions?.[0];

  return (
    <div className="min-h-screen w-full max-w-[300px] bg-slate-950 p-3 text-slate-100">
      <div className="rounded-[28px] border border-cyan-400/20 bg-slate-900/95 p-4 shadow-2xl shadow-cyan-950/50">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Meet Saver</p>
            <h1 className="mt-1 line-clamp-2 text-base font-semibold">{meeting.title}</h1>
          </div>
          <DollarSign className="h-8 w-8 rounded-2xl bg-cyan-400/15 p-2 text-cyan-300" />
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-300 p-[1px]">
          <div className="rounded-3xl bg-slate-950 p-4 text-center">
            <p className="text-xs text-slate-400">Cash-burn live</p>
            <p className="mt-1 text-4xl font-black tracking-tight text-white">
              {formatCurrency(snapshot.current_cost)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {formatCurrency(snapshot.current_burn_rate_per_hour)}/h - {formatDuration(snapshot.remaining_seconds)} restants
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-white/5 p-3">
            <Users className="mb-2 h-4 w-4 text-cyan-300" />
            <p className="text-slate-400">Presents</p>
            <p className="text-lg font-bold">{snapshot.participant_costs.filter((p) => p.present).length}</p>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <TrendingDown className="mb-2 h-4 w-4 text-emerald-300" />
            <p className="text-slate-400">Economies</p>
            <p className="text-lg font-bold">{formatCurrency(snapshot.savings_generated)}</p>
          </div>
        </div>

        {topSuggestion ? (
          <div className="mt-4 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <Clock className="h-4 w-4" />
              Action suggeree
            </p>
            <p className="mt-2 text-sm">
              Liberez <span className="font-bold">{topSuggestion.name}</span>.
            </p>
            <p className="mt-1 text-xs text-emerald-100/80">
              Economie potentielle : {formatCurrency(topSuggestion.savings_amount)}
            </p>
            <button
              className="mt-3 w-full rounded-2xl bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950"
              onClick={() => onValidateDeparture(topSuggestion)}
            >
              Valider le depart
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-white/5 p-3 text-xs text-slate-400">
            Aucune liberation recommandee pour le bloc actuel.
          </div>
        )}
      </div>
    </div>
  );
}
