import { Users } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "../lib/format";

export function ParticipantsPanel({ participants, roles, onSaveParticipant, onSaveRole, onSeedDefaults, copy }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [roleDraft, setRoleDraft] = useState({ name: "", hourly_rate: "" });

  const text = {
    ratesLabel: "Taux horaires",
    title: "Participants et roles",
    peopleTracked: "personnes suivies",
    rolePlaceholder: "Role (ex: Senior)",
    add: "Ajouter",
    demoRoles: "Roles demo",
    noRole: "Aucun role",
    save: "Sauver",
    saving: "...",
    ...copy,
  };

  function updateDraft(id, patch) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  }

  async function saveParticipant(participant) {
    const draft = drafts[participant.id] || {};
    setSavingId(participant.id);
    await onSaveParticipant(participant.id, {
      display_name: draft.display_name ?? participant.display_name,
      role_id: draft.role_id ?? participant.role_id,
      hourly_rate: normalizeRate(draft.hourly_rate ?? participant.hourly_rate),
    });
    setSavingId(null);
  }

  function normalizeRate(value) {
    return String(value ?? "").replace(",", ".").trim();
  }

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/20">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">{text.ratesLabel}</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{text.title}</h2>
        </div>
        <div className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
          {participants.length} {text.peopleTracked}
        </div>
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (roleDraft.name && roleDraft.hourly_rate) {
            await onSaveRole({ ...roleDraft, hourly_rate: normalizeRate(roleDraft.hourly_rate) });
            setRoleDraft({ name: "", hourly_rate: "" });
            return;
          }
          await onSeedDefaults();
        }}
        className="mb-5 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-[1fr_140px_auto]"
      >
        <input
          className="input"
          placeholder={text.rolePlaceholder}
          value={roleDraft.name}
          onChange={(event) => setRoleDraft((current) => ({ ...current, name: event.target.value }))}
        />
        <label className="rate-field">
          <span className="rate-prefix">€</span>
          <input
            className="input rate-input"
            inputMode="decimal"
            placeholder="0 /h"
            value={roleDraft.hourly_rate}
            onChange={(event) => setRoleDraft((current) => ({ ...current, hourly_rate: event.target.value }))}
          />
        </label>
        <button className="btn-secondary" type="submit">
          {roleDraft.name || roleDraft.hourly_rate ? text.add : text.demoRoles}
        </button>
      </form>

      <div className="space-y-3">
        {participants.map((participant) => {
          const draft = drafts[participant.id] || {};
          return (
            <div key={participant.id} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 lg:grid-cols-[1.2fr_1fr_130px_auto]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <Users size={18} />
                </div>
                <div>
                  <input
                    className="w-full bg-transparent font-semibold text-white outline-none"
                    value={draft.display_name ?? participant.display_name}
                    onChange={(event) => updateDraft(participant.id, { display_name: event.target.value })}
                  />
                  <p className="text-xs text-slate-500">{participant.email}</p>
                </div>
              </div>

              <select
                className="input"
                value={draft.role_id ?? participant.role_id ?? ""}
                onChange={(event) => updateDraft(participant.id, { role_id: event.target.value })}
              >
                <option value="">{text.noRole}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} - {formatCurrency(role.hourly_rate)}/h
                  </option>
                ))}
              </select>

              <label className="rate-field">
                <span className="rate-prefix">€</span>
                <input
                  className="input rate-input"
                  inputMode="decimal"
                  value={draft.hourly_rate ?? participant.hourly_rate ?? ""}
                  onChange={(event) => updateDraft(participant.id, { hourly_rate: event.target.value })}
                />
              </label>

              <button className="btn-primary" type="button" onClick={() => saveParticipant(participant)} disabled={savingId === participant.id}>
                {savingId === participant.id ? text.saving : text.save}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
