import { DollarSign, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDuration } from "../lib/format";

export function CashBurnPanel({ meeting, snapshot, copy }) {
  const text = {
    title: "Cash-burn live",
    elapsed: "ecoulees",
    remaining: "restantes",
    savings: "Economies generees",
    burnRate: "Burn-rate",
    plannedBudget: "Budget prevu",
    margin: "Marge",
    overrun: "Depassement",
    ...copy,
  };

  if (!meeting || !snapshot) {
    return (
      <section className="glass-panel p-6">
        <div className="h-80 animate-pulse rounded-3xl bg-white/5" />
      </section>
    );
  }

  const budgetDelta = snapshot.planned_budget - snapshot.current_cost;
  const budgetProgress = Math.min(100, (snapshot.current_cost / Math.max(snapshot.planned_budget, 1)) * 100);

  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-white/10 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{text.title}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
              {formatCurrency(snapshot.current_cost)}
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              {formatDuration(snapshot.elapsed_seconds)} {text.elapsed} - {formatDuration(snapshot.remaining_seconds)} {text.remaining}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <TrendingDown size={18} />
                <span className="text-sm">{text.savings}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(snapshot.savings_generated)}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
              <div className="flex items-center gap-2 text-cyan-200">
                <DollarSign size={18} />
                <span className="text-sm">{text.burnRate}</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(snapshot.current_burn_rate_per_hour)}/h
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-xs text-slate-400">
            <span>{text.plannedBudget} {formatCurrency(snapshot.planned_budget)}</span>
            <span>{budgetDelta >= 0 ? text.margin : text.overrun} {formatCurrency(Math.abs(budgetDelta))}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400"
              style={{ width: `${budgetProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="h-80 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={snapshot.chart}>
            <defs>
              <linearGradient id="actualCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.16)" />
            <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(value) => `${value}€`} />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.94)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                color: "#e2e8f0",
              }}
              formatter={(value) => formatCurrency(value)}
            />
            <Area type="monotone" dataKey="planned" stroke="#64748b" fill="transparent" strokeDasharray="5 5" />
            <Area type="monotone" dataKey="actual" stroke="#22d3ee" fill="url(#actualCost)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
