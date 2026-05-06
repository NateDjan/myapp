import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, DollarSign, Languages, LayoutPanelLeft, Sparkles, TrendingDown, Users } from "lucide-react";
import { api } from "./lib/api";
import { formatCurrency, formatTimeRange } from "./lib/format";
import { MetricCard } from "./components/MetricCard";
import { CashBurnPanel } from "./components/CashBurnPanel";
import { ParticipantsPanel } from "./components/ParticipantsPanel";
import { AgendaPanel } from "./components/AgendaPanel";
import { OverlayPanel } from "./components/OverlayPanel";

const defaultRoles = [
  { name: "Senior", hourly_rate: 120 },
  { name: "Junior", hourly_rate: 60 },
  { name: "Product", hourly_rate: 95 },
  { name: "Design", hourly_rate: 80 },
];

const copy = {
  fr: {
    loading: "Chargement de Meet Saver...",
    eyebrow: "Fintech meeting ops",
    subtitle:
      "Suivez le cash-burn des reunions en direct et liberez les expertises au moment ou elles ne creent plus de valeur.",
    languageLabel: "Langue",
    connectGoogle: "Connecter Google",
    syncCalendar: "Sync calendrier",
    syncInProgress: "Synchronisation Google Calendar en cours...",
    syncDone: (count) => `${count} reunion(s) synchronisee(s) depuis Google Calendar.`,
    rolesSeeded: "Taux par role initialises.",
    roleSaved: (name) => `Role ${name} enregistre.`,
    suggested: (name, amount) => `Action suggeree : Liberez ${name}. Economie potentielle : ${amount}.`,
    departureValidated: (name, amount) => `Depart valide pour ${name}. Economie potentielle : ${amount}.`,
    currentCost: "Cout actuel",
    activeHourly: "actifs",
    validatedSavings: "Economies validees",
    confirmedDepartures: "Departs anticipes confirmes",
    presentParticipants: "Participants presents",
    pricedProfiles: "profils tarifes",
    sidePanel: "Side-panel",
    openOverlay: "Ouvrir l'overlay",
    meetingsToday: "Reunions du jour",
    activeSelection: "Selection active",
    footer: (user) => `Connecte en demo : ${user}. Configurez Google OAuth pour une lecture reelle du calendrier.`,
    participants: {
      ratesLabel: "Taux horaires",
      title: "Participants et roles",
      peopleTracked: "personnes suivies",
      rolePlaceholder: "Role (ex: Senior)",
      add: "Ajouter",
      demoRoles: "Roles demo",
      noRole: "Aucun role",
      save: "Sauver",
      saving: "...",
    },
    cashBurn: {
      title: "Cash-burn live",
      elapsed: "ecoulees",
      remaining: "restantes",
      savings: "Economies generees",
      burnRate: "Burn-rate",
      plannedBudget: "Budget prevu",
      margin: "Marge",
      overrun: "Depassement",
    },
    agenda: {
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
    },
  },
  en: {
    loading: "Loading Meet Saver...",
    eyebrow: "Fintech meeting ops",
    subtitle:
      "Track meeting cash burn live and release expertise as soon as it is no longer creating value.",
    languageLabel: "Language",
    connectGoogle: "Connect Google",
    syncCalendar: "Sync calendar",
    syncInProgress: "Syncing Google Calendar...",
    syncDone: (count) => `${count} meeting(s) synced from Google Calendar.`,
    rolesSeeded: "Default role rates initialized.",
    roleSaved: (name) => `Role ${name} saved.`,
    suggested: (name, amount) => `Suggested action: release ${name}. Potential savings: ${amount}.`,
    departureValidated: (name, amount) => `Departure validated for ${name}. Potential savings: ${amount}.`,
    currentCost: "Current cost",
    activeHourly: "active",
    validatedSavings: "Validated savings",
    confirmedDepartures: "Confirmed early departures",
    presentParticipants: "Participants present",
    pricedProfiles: "priced profiles",
    sidePanel: "Side panel",
    openOverlay: "Open overlay",
    meetingsToday: "Today's meetings",
    activeSelection: "Active selection",
    footer: (user) => `Demo user: ${user}. Configure Google OAuth for real calendar access.`,
    participants: {
      ratesLabel: "Hourly rates",
      title: "Participants and roles",
      peopleTracked: "people tracked",
      rolePlaceholder: "Role (e.g. Senior)",
      add: "Add",
      demoRoles: "Demo roles",
      noRole: "No role",
      save: "Save",
      saving: "...",
    },
    cashBurn: {
      title: "Live cash burn",
      elapsed: "elapsed",
      remaining: "remaining",
      savings: "Generated savings",
      burnRate: "Burn rate",
      plannedBudget: "Planned budget",
      margin: "Margin",
      overrun: "Overrun",
    },
    agenda: {
      agendaLabel: "Agenda",
      title: "Blocks and required expertise",
      section: "Section",
      planned: "planned min",
      required: "required",
      done: "Done",
      complete: "Complete",
      alertLabel: "Profitability alert",
      departureTitle: "Early departures",
      suggestedAction: "Suggested action: release",
      potentialSavings: "Potential savings",
      validate: "Validate departure",
      empty: "Complete a section to trigger recommendations based on expertise still required.",
    },
  },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [meetingDetail, setMeetingDetail] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState("fr");
  const text = copy[language];
  const isOverlay = window.location.pathname === "/meeting-overlay";

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) || meetingDetail?.meeting,
    [meetingDetail?.meeting, meetings, selectedMeetingId],
  );

  const refreshCore = useCallback(async () => {
    const [me, roleData, participantData, meetingData] = await Promise.all([
      api.getMe(),
      api.getRoles(),
      api.getParticipants(),
      api.getMeetings(),
    ]);
    setUser(me.user);
    setRoles(roleData.roles);
    setParticipants(participantData.participants);
    setMeetings(meetingData.meetings);

    if (!selectedMeetingId && meetingData.meetings.length > 0) {
      setSelectedMeetingId(meetingData.meetings[0].id);
    }
  }, [selectedMeetingId]);

  useEffect(() => {
    refreshCore()
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [refreshCore]);

  const loadMeeting = useCallback(async () => {
    if (!selectedMeetingId) return;
    const detail = await api.getMeeting(selectedMeetingId);
    setMeetingDetail(detail);
    setSnapshot(detail.snapshot);
  }, [selectedMeetingId]);

  useEffect(() => {
    loadMeeting().catch((error) => setNotice(error.message));
  }, [loadMeeting]);

  useEffect(() => {
    if (!selectedMeetingId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const costs = await api.getCosts(selectedMeetingId);
        setSnapshot(costs);
      } catch (error) {
        setNotice(error.message);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [selectedMeetingId]);

  async function syncCalendar() {
    setNotice(text.syncInProgress);
    try {
      const result = await api.syncCalendar();
      await refreshCore();
      setNotice(text.syncDone(result.count));
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function connectGoogle() {
    try {
      const { url } = await api.getGoogleAuthUrl();
      window.location.href = url;
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function seedDefaults() {
    for (const role of defaultRoles) {
      await api.upsertRole(role);
    }
    await refreshCore();
    setNotice(text.rolesSeeded);
  }

  async function saveRole(role) {
    await api.upsertRole(role);
    await refreshCore();
    setNotice(text.roleSaved(role.name));
  }

  async function saveParticipant(participantId, payload) {
    await api.updateParticipant(participantId, payload);
    const participantData = await api.getParticipants();
    setParticipants(participantData.participants);
    await loadMeeting();
  }

  async function completeBlock(blockId) {
    const result = await api.completeAgendaBlock(blockId, true);
    await loadMeeting();
    if (result.suggestions?.length) {
      const top = result.suggestions[0];
      setNotice(text.suggested(top.name, formatCurrency(top.savings_amount)));
    }
  }

  async function validateDeparture(suggestion) {
    const result = await api.validateDeparture(selectedMeetingId, {
      participant_id: suggestion.participant_id,
      agenda_block_id: suggestion.agenda_block_id,
    });
    setSnapshot(result.snapshot);
    await loadMeeting();
    setNotice(text.departureValidated(suggestion.name, formatCurrency(result.departure.savings_amount)));
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-200">{text.loading}</div>;
  }

  if (isOverlay) {
    return (
      <OverlayPanel
        meeting={selectedMeeting}
        snapshot={snapshot}
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        onSelectMeeting={setSelectedMeetingId}
        onValidateDeparture={validateDeparture}
      />
    );
  }

  return (
    <main className="min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles size={14} /> {text.eyebrow}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Meet Saver</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              {text.subtitle}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-2 shadow-lg shadow-black/20 sm:w-auto md:ml-auto md:self-start">
            <div className="flex items-center justify-between gap-2 rounded-full border border-white/10 bg-slate-950/70 p-1 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 px-2 font-semibold">
                <Languages size={14} /> {text.languageLabel}
              </span>
              <div className="flex rounded-full bg-slate-900 p-1">
                {["fr", "en"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`language-toggle ${language === option ? "language-toggle-active" : ""}`}
                    onClick={() => setLanguage(option)}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-secondary" onClick={connectGoogle}>
                <CalendarDays size={18} /> {text.connectGoogle}
              </button>
              <button className="btn-primary" onClick={syncCalendar}>
                {text.syncCalendar}
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {notice}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            label={text.currentCost}
            value={formatCurrency(snapshot?.current_cost || 0)}
            detail={`${formatCurrency(snapshot?.current_burn_rate_per_hour || 0)}/h ${text.activeHourly}`}
          />
          <MetricCard
            icon={TrendingDown}
            label={text.validatedSavings}
            value={formatCurrency(snapshot?.savings_generated || 0)}
            detail={text.confirmedDepartures}
          />
          <MetricCard
            icon={Users}
            label={text.presentParticipants}
            value={snapshot?.participant_costs?.filter((participant) => participant.present).length || 0}
            detail={`${participants.length} ${text.pricedProfiles}`}
          />
          <MetricCard
            icon={LayoutPanelLeft}
            label={text.sidePanel}
            value="300px"
            detail={<a className="text-cyan-200 underline" href="/meeting-overlay">{text.openOverlay}</a>}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="panel">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{text.meetingsToday}</p>
                  <h2 className="mt-1 text-xl font-bold text-white">{text.activeSelection}</h2>
                </div>
                <select
                  className="input md:min-w-80"
                  value={selectedMeetingId || ""}
                  onChange={(event) => setSelectedMeetingId(event.target.value)}
                >
                  {meetings.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title} - {formatTimeRange(meeting.starts_at, meeting.ends_at)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <CashBurnPanel meeting={selectedMeeting} snapshot={snapshot} copy={text.cashBurn} />
            <AgendaPanel
              agenda={meetingDetail?.agenda || []}
              suggestions={snapshot?.suggestions || []}
              onCompleteBlock={completeBlock}
              onValidateDeparture={validateDeparture}
              copy={text.agenda}
            />
          </div>

          <ParticipantsPanel
            participants={participants}
            roles={roles}
            onSaveParticipant={saveParticipant}
            onSaveRole={saveRole}
            onSeedDefaults={seedDefaults}
            copy={text.participants}
          />
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">
          {text.footer(user?.display_name || user?.email)}
        </footer>
      </div>
    </main>
  );
}
