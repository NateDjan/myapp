import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, DollarSign, LayoutPanelLeft, Sparkles, TrendingDown, Users } from "lucide-react";
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
    setNotice("Synchronisation Google Calendar en cours...");
    try {
      const result = await api.syncCalendar();
      await refreshCore();
      setNotice(`${result.count} reunion(s) synchronisee(s) depuis Google Calendar.`);
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
    setNotice("Taux par role initialises.");
  }

  async function saveRole(role) {
    await api.upsertRole(role);
    await refreshCore();
    setNotice(`Role ${role.name} enregistre.`);
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
      setNotice(`Action suggeree : Liberez ${top.name}. Economie potentielle : ${formatCurrency(top.savings_amount)}.`);
    }
  }

  async function validateDeparture(suggestion) {
    const result = await api.validateDeparture(selectedMeetingId, {
      participant_id: suggestion.participant_id,
      agenda_block_id: suggestion.agenda_block_id,
    });
    setSnapshot(result.snapshot);
    await loadMeeting();
    setNotice(`Depart valide pour ${suggestion.name}. Economie potentielle : ${formatCurrency(result.departure.savings_amount)}.`);
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-200">Chargement de Meet Saver...</div>;
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
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles size={14} /> Fintech meeting ops
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Meet Saver</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              Suivez le cash-burn des reunions en direct et liberez les expertises au moment ou elles ne creent plus de valeur.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-secondary" onClick={connectGoogle}>
              <CalendarDays size={18} /> Connecter Google
            </button>
            <button className="btn-primary" onClick={syncCalendar}>
              Sync calendrier
            </button>
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
            label="Cout actuel"
            value={formatCurrency(snapshot?.current_cost || 0)}
            detail={`${formatCurrency(snapshot?.current_burn_rate_per_hour || 0)}/h actifs`}
          />
          <MetricCard
            icon={TrendingDown}
            label="Economies validees"
            value={formatCurrency(snapshot?.savings_generated || 0)}
            detail="Departs anticipes confirmes"
          />
          <MetricCard
            icon={Users}
            label="Participants presents"
            value={snapshot?.participant_costs?.filter((participant) => participant.present).length || 0}
            detail={`${participants.length} profils tarifes`}
          />
          <MetricCard
            icon={LayoutPanelLeft}
            label="Side-panel"
            value="300px"
            detail={<a className="text-cyan-200 underline" href="/meeting-overlay">Ouvrir l'overlay</a>}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="panel">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Reunions du jour</p>
                  <h2 className="mt-1 text-xl font-bold text-white">Selection active</h2>
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
            <CashBurnPanel meeting={selectedMeeting} snapshot={snapshot} />
            <AgendaPanel
              agenda={meetingDetail?.agenda || []}
              suggestions={snapshot?.suggestions || []}
              onCompleteBlock={completeBlock}
              onValidateDeparture={validateDeparture}
            />
          </div>

          <ParticipantsPanel
            participants={participants}
            roles={roles}
            onSaveParticipant={saveParticipant}
            onSaveRole={saveRole}
            onSeedDefaults={seedDefaults}
          />
        </section>

        <footer className="pb-4 text-center text-xs text-slate-500">
          Connecte en demo : {user?.display_name || user?.email}. Configurez Google OAuth pour une lecture reelle du calendrier.
        </footer>
      </div>
    </main>
  );
}
