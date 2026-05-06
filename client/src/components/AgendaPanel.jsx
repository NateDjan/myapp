import { CheckCircle2, TrendingDown } from "lucide-react";
import { formatCurrency } from "../lib/format";

export function AgendaPanel({ agenda, suggestions, onCompleteBlock, onValidateDeparture, copy }) {
  const text = {
    agendaLabel: "Ordre du jour",
    title: "Blocs et expertises requises",
    section: "Section",
    planned: "min prevues",
    required: "requis",
    done: "Termine",
    complete: "Terminer",
    alertLabel: "Alerte de rentabilite",
    departureTitle: "Departs anticipes",
    suggestedAction: "Action suggeree : Liberez",
    potentialSavings: "Economie potentielle",
    validate: "Valider le depart",
    empty: "Terminez une section pour declencher des recommandations selon les expertises encore requises.",
    ...copy,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="panel">
        <div className="mb-5">
          <p className="section-label">{text.agendaLabel}</p>
          <h2 className="text-xl font-semibold text-white">{text.title}</h2>
        </div>

        <div className="space-y-4">
          {agenda.map((block) => (
            <div
              key={block.id}
              className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">
                    {text.section} {block.position} : {block.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {block.planned_minutes} {text.planned} · {block.required_participant_ids?.length || 0} {text.required}
                  </p>
                </div>
                {block.status === "completed" ? (
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {text.done}
                  </span>
                ) : (
                  <button className="btn-secondary" onClick={() => onCompleteBlock(block.id)}>
                    <CheckCircle2 className="h-4 w-4" />
                    {text.complete}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel border-emerald-400/20 bg-emerald-400/5">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
            <TrendingDown className="h-5 w-5" />
          </span>
          <div>
            <p className="section-label">{text.alertLabel}</p>
            <h2 className="text-xl font-semibold text-white">{text.departureTitle}</h2>
          </div>
        </div>

        <div className="space-y-4">
          {suggestions?.length ? (
            suggestions.map((suggestion) => (
              <div key={suggestion.participant_id} className="rounded-3xl bg-slate-950/80 p-4">
                <p className="text-sm font-semibold text-emerald-200">
                  {text.suggestedAction} {suggestion.name}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {suggestion.reason} {text.potentialSavings} :{" "}
                  <span className="font-semibold text-white">{formatCurrency(suggestion.savings_amount)}</span>
                </p>
                <button className="btn-primary mt-4 w-full" onClick={() => onValidateDeparture(suggestion)}>
                  {text.validate}
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              {text.empty}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
