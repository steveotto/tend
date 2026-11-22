export function noLinkedRhythmHealthMessage(itemTerm: string): string {
  return `Link a Rhythm to this ${itemTerm} to start building your Health score.`;
}

export function cardioHealthStatusMessage({
  hasTrackingStartDate,
  hasWeeklyGoals,
  hasCompletedWeek
}: {
  hasTrackingStartDate: boolean;
  hasWeeklyGoals: boolean;
  hasCompletedWeek: boolean;
}): string | null {
  if (!hasTrackingStartDate && !hasWeeklyGoals) {
    return null;
  }
  if (!hasTrackingStartDate) {
    return 'Set a Cardio tracking start date. Cardio Health uses your run logs and saved weekly goals.';
  }
  if (!hasWeeklyGoals) {
    return 'Save weekly run and distance goals. Cardio Health uses your run logs against those goals.';
  }
  if (!hasCompletedWeek) {
    return 'Complete one Monday–Sunday week with saved run and distance goals before a Cardio Health score is available. Cardio Health uses your run logs and weekly goals.';
  }
  return null;
}
