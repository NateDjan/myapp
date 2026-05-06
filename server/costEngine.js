export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function meetingDurationSeconds(meeting) {
  const start = new Date(meeting.starts_at).getTime();
  const end = new Date(meeting.ends_at).getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function elapsedSecondsForParticipant(meeting, participant, now = new Date()) {
  const meetingStart = new Date(meeting.starts_at).getTime();
  const meetingEnd = new Date(meeting.ends_at).getTime();
  const joinedAt = participant.joined_at ? new Date(participant.joined_at).getTime() : meetingStart;
  const leftAt = participant.left_at ? new Date(participant.left_at).getTime() : Math.min(now.getTime(), meetingEnd);
  return Math.max(0, Math.floor((Math.min(leftAt, meetingEnd) - Math.max(joinedAt, meetingStart)) / 1000));
}

export function calculateMeetingSnapshot(meeting, participants, agendaBlocks = [], departures = [], now = new Date()) {
  const meetingEnd = new Date(meeting.ends_at).getTime();
  const meetingStart = new Date(meeting.starts_at).getTime();
  const currentTime = Math.min(Math.max(now.getTime(), meetingStart), meetingEnd);
  const elapsedMeetingSeconds = Math.max(0, Math.floor((currentTime - meetingStart) / 1000));
  const remainingMeetingSeconds = Math.max(0, Math.floor((meetingEnd - currentTime) / 1000));

  const participantCosts = participants.map((participant) => {
    const hourlyRate = toNumber(participant.hourly_rate);
    const elapsedSeconds = elapsedSecondsForParticipant(meeting, participant, now);
    const present = !participant.left_at && currentTime < meetingEnd;
    return {
      ...participant,
      hourly_rate: hourlyRate,
      elapsed_seconds: elapsedSeconds,
      current_cost: (elapsedSeconds * hourlyRate) / 3600,
      projected_remaining_cost: present ? (remainingMeetingSeconds * hourlyRate) / 3600 : 0,
      present
    };
  });

  const currentCost = participantCosts.reduce((sum, participant) => sum + participant.current_cost, 0);
  const currentBurnRatePerHour = participantCosts
    .filter((participant) => participant.present)
    .reduce((sum, participant) => sum + participant.hourly_rate, 0);
  const plannedBudget = participants.reduce(
    (sum, participant) => sum + (meetingDurationSeconds(meeting) * toNumber(participant.hourly_rate)) / 3600,
    0
  );
  const savingsGenerated = departures.reduce((sum, departure) => sum + toNumber(departure.savings_amount), 0);

  return {
    meeting_id: meeting.id,
    current_cost: roundMoney(currentCost),
    planned_budget: roundMoney(plannedBudget),
    savings_generated: roundMoney(savingsGenerated),
    current_burn_rate_per_hour: roundMoney(currentBurnRatePerHour),
    elapsed_seconds: elapsedMeetingSeconds,
    remaining_seconds: remainingMeetingSeconds,
    participant_costs: participantCosts.map((participant) => ({
      meeting_participant_id: participant.meeting_participant_id,
      participant_id: participant.participant_id,
      name: participant.name,
      role_name: participant.role_name,
      hourly_rate: participant.hourly_rate,
      present: participant.present,
      elapsed_seconds: participant.elapsed_seconds,
      current_cost: roundMoney(participant.current_cost),
      projected_remaining_cost: roundMoney(participant.projected_remaining_cost)
    })),
    chart: buildCostChart(meeting, participants, currentCost),
    suggestions: buildDepartureSuggestions(meeting, participantCosts, agendaBlocks, now)
  };
}

function buildCostChart(meeting, participants, currentCost) {
  const durationSeconds = Math.max(meetingDurationSeconds(meeting), 1);
  const start = new Date(meeting.starts_at).getTime();
  const end = new Date(meeting.ends_at).getTime();
  const totalRate = participants.reduce((sum, participant) => sum + toNumber(participant.hourly_rate), 0);
  const plannedBudget = (durationSeconds * totalRate) / 3600;
  const points = [];
  const steps = 6;

  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const timestamp = new Date(start + (end - start) * ratio);
    points.push({
      label: timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      planned: roundMoney(plannedBudget * ratio),
      actual: index === steps ? roundMoney(currentCost) : roundMoney(plannedBudget * ratio)
    });
  }

  return points;
}

function buildDepartureSuggestions(meeting, participantCosts, agendaBlocks, now) {
  const currentTime = now.getTime();
  const remainingSeconds = Math.max(0, Math.floor((new Date(meeting.ends_at).getTime() - currentTime) / 1000));
  const completedBlocks = agendaBlocks.filter((block) => block.status === 'completed');
  const activeFutureBlocks = agendaBlocks.filter((block) => block.status !== 'completed');

  if (!completedBlocks.length || remainingSeconds <= 0) {
    return [];
  }

  const requiredLater = new Set();
  activeFutureBlocks.forEach((block) => {
    (block.required_participant_ids || []).forEach((id) => requiredLater.add(String(id)));
  });

  return participantCosts
    .filter((participant) => participant.present && !requiredLater.has(String(participant.participant_id)))
    .map((participant) => ({
      meeting_participant_id: participant.meeting_participant_id,
      participant_id: participant.participant_id,
      name: participant.name,
      reason: `Son expertise n'est plus requise dans les blocs restants.`,
      savings_amount: roundMoney((remainingSeconds * participant.hourly_rate) / 3600)
    }))
    .filter((suggestion) => suggestion.savings_amount > 0)
    .sort((a, b) => b.savings_amount - a.savings_amount);
}

export function calculateDepartureSavings(meeting, participant, leftAt = new Date()) {
  const remainingSeconds = Math.max(0, Math.floor((new Date(meeting.ends_at).getTime() - leftAt.getTime()) / 1000));
  return roundMoney((remainingSeconds * toNumber(participant.hourly_rate)) / 3600);
}

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}
