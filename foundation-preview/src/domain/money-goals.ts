export type MoneyGoalDirection = 'increase' | 'decrease';

export type GoalCheckIn = {
  id: string;
  effectiveDate: string;
  balanceMinor: number;
  note?: string;
};

export type GoalCorrection = {
  effectiveDate: string;
  previousBalanceMinor: number;
  previousNote?: string;
  replacedAt: string;
};

export type MoneyGoal = {
  id: string;
  title: string;
  currency: string;
  direction: MoneyGoalDirection;
  startingBalanceMinor: number;
  startDate: string;
  targetBalanceMinor: number;
  targetDate: string;
  checkIns: GoalCheckIn[];
  correctionHistory: GoalCorrection[];
};

export type GoalDraft = {
  title: string;
  currency: string;
  direction: MoneyGoalDirection;
  startingBalance: string;
  startDate: string;
  targetBalance: string;
  targetDate: string;
};

export type CheckInDraft = {
  effectiveDate: string;
  balance: string;
  note: string;
};

export type GoalDraftErrors = Partial<Record<keyof GoalDraft, string>>;
export type CheckInDraftErrors = Partial<Record<keyof CheckInDraft, string>>;

export type TimelinePoint = { date: string; value: number };
export type GoalTimeline = {
  planned: [TimelinePoint, TimelinePoint];
  actual: TimelinePoint[];
};

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day!);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function localDateString(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currencyFractionDigits(currency: string): number | null {
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  try {
    if (typeof Intl.supportedValuesOf === 'function' && !Intl.supportedValuesOf('currency').includes(currency)) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? null;
  } catch {
    return null;
  }
}

export function parseMoneyInput(value: string, currency: string): number | null {
  const fractionDigits = currencyFractionDigits(currency);
  if (fractionDigits === null || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > fractionDigits) return null;
  const scaledFraction = fraction.padEnd(fractionDigits, '0');
  const minorUnits = BigInt(whole!) * 10n ** BigInt(fractionDigits) + BigInt(scaledFraction || '0');
  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minorUnits);
}

export function moneyInputValue(amountMinor: number, currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  if (fractionDigits === null || !Number.isSafeInteger(amountMinor) || amountMinor < 0) return '';
  const amount = BigInt(amountMinor);
  const scale = 10n ** BigInt(fractionDigits);
  const whole = (amount / scale).toString();
  if (!fractionDigits) return whole;
  return `${whole}.${(amount % scale).toString().padStart(fractionDigits, '0')}`;
}

export function formatMoney(amountMinor: number, currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  if (fractionDigits === null) return 'Invalid currency';
  const amount = BigInt(Math.abs(amountMinor));
  const scale = 10n ** BigInt(fractionDigits);
  const whole = amount / scale;
  const wholeFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  });
  const parts = wholeFormatter.formatToParts(whole);
  if (amountMinor < 0) {
    const minusSign = new Intl.NumberFormat('en-US', { useGrouping: false })
      .formatToParts(-1)
      .find(part => part.type === 'minusSign')?.value;
    if (minusSign) parts.unshift({ type: 'minusSign', value: minusSign });
  }
  if (fractionDigits === 0) return parts.map(part => part.value).join('');
  const decimal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).formatToParts(0).find(part => part.type === 'decimal')?.value ?? '.';
  const fraction = new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumIntegerDigits: fractionDigits,
    maximumFractionDigits: 0
  }).format(Number(amount % scale));
  const lastIntegerIndex = parts.reduce((last, part, index) => part.type === 'integer' ? index : last, -1);
  parts.splice(lastIntegerIndex + 1, 0, { type: 'decimal', value: decimal }, { type: 'fraction', value: fraction });
  return parts.map(part => part.value).join('');
}

export function validateGoalDraft(draft: GoalDraft, existing?: MoneyGoal): GoalDraftErrors {
  const errors: GoalDraftErrors = {};
  const currency = draft.currency.toUpperCase();
  const startBalance = parseMoneyInput(draft.startingBalance, currency);
  const targetBalance = parseMoneyInput(draft.targetBalance, currency);

  if (!draft.title.trim()) errors.title = 'Enter a goal title.';
  if (currencyFractionDigits(currency) === null) errors.currency = 'Enter a supported three-letter currency code.';
  if (existing && currency !== existing.currency && (existing.checkIns.length > 0 || existing.correctionHistory.length > 0)) {
    errors.currency = 'Currency cannot change while this goal has recorded check-ins.';
  }
  if (startBalance === null) errors.startingBalance = 'Enter a valid starting balance for this currency.';
  if (targetBalance === null) errors.targetBalance = 'Enter a valid target balance for this currency.';
  if (!isValidDate(draft.startDate)) errors.startDate = 'Enter a valid starting date.';
  if (!isValidDate(draft.targetDate)) errors.targetDate = 'Enter a valid target date.';

  if (isValidDate(draft.startDate) && isValidDate(draft.targetDate) && draft.targetDate <= draft.startDate) {
    errors.targetDate = 'The target date must be after the starting date.';
  }
  if (startBalance !== null && targetBalance !== null) {
    if (startBalance === targetBalance) {
      errors.targetBalance = 'The target must differ from the starting balance.';
    } else if (draft.direction === 'increase' && targetBalance <= startBalance) {
      errors.targetBalance = 'An increasing goal needs a target above its starting balance.';
    } else if (draft.direction === 'decrease' && targetBalance >= startBalance) {
      errors.targetBalance = 'A decreasing goal needs a target below its starting balance.';
    }
  }
  if (existing && isValidDate(draft.startDate) && existing.checkIns.some(checkIn => checkIn.effectiveDate < draft.startDate)) {
    errors.startDate = 'The starting date cannot be after an existing check-in.';
  }
  return errors;
}

export function goalFromDraft(
  draft: GoalDraft,
  id: string,
  existing?: MoneyGoal
): { goal?: MoneyGoal; errors: GoalDraftErrors } {
  const errors = validateGoalDraft(draft, existing);
  if (Object.keys(errors).length) return { errors };
  const currency = draft.currency.toUpperCase();
  const startingBalanceMinor = parseMoneyInput(draft.startingBalance, currency)!;
  const targetBalanceMinor = parseMoneyInput(draft.targetBalance, currency)!;
  return {
    errors,
    goal: {
      id,
      title: draft.title.trim(),
      currency,
      direction: draft.direction,
      startingBalanceMinor,
      startDate: draft.startDate,
      targetBalanceMinor,
      targetDate: draft.targetDate,
      checkIns: existing?.checkIns ?? [],
      correctionHistory: existing?.correctionHistory ?? []
    }
  };
}

export function validateCheckInDraft(
  goal: MoneyGoal,
  draft: CheckInDraft,
  currentDate: string,
  correctingCheckIn?: GoalCheckIn
): CheckInDraftErrors {
  const errors: CheckInDraftErrors = {};
  if (!isValidDate(draft.effectiveDate)) {
    errors.effectiveDate = 'Enter a valid effective date.';
  } else if (draft.effectiveDate < goal.startDate) {
    errors.effectiveDate = 'A check-in cannot be before the starting date.';
  } else if (draft.effectiveDate > currentDate) {
    errors.effectiveDate = 'An observed balance check-in cannot be in the future.';
  } else if (correctingCheckIn && draft.effectiveDate !== correctingCheckIn.effectiveDate) {
    errors.effectiveDate = 'The date of an existing check-in cannot be changed while correcting it.';
  }
  if (parseMoneyInput(draft.balance, goal.currency) === null) {
    errors.balance = 'Enter a valid balance for this currency.';
  }
  return errors;
}

export function saveCheckIn(
  goal: MoneyGoal,
  draft: CheckInDraft,
  replacedAt: string,
  currentDate: string,
  correctingCheckIn?: GoalCheckIn
): { goal?: MoneyGoal; errors: CheckInDraftErrors; corrected: boolean } {
  const errors = validateCheckInDraft(goal, draft, currentDate, correctingCheckIn);
  if (Object.keys(errors).length) return { errors, corrected: false };
  const balanceMinor = parseMoneyInput(draft.balance, goal.currency)!;
  const existing = correctingCheckIn
    ? goal.checkIns.find(checkIn => checkIn.id === correctingCheckIn.id)
    : goal.checkIns.find(checkIn => checkIn.effectiveDate === draft.effectiveDate);
  if (correctingCheckIn && !existing) {
    return {
      errors: { effectiveDate: 'The check-in selected for correction is no longer available.' },
      corrected: false
    };
  }
  const note = draft.note.length ? { note: draft.note } : {};
  const checkIn: GoalCheckIn = {
    id: existing?.id ?? `check-in-${draft.effectiveDate}`,
    effectiveDate: draft.effectiveDate,
    balanceMinor,
    ...note
  };
  const correction = existing
    ? [{
        effectiveDate: existing.effectiveDate,
        previousBalanceMinor: existing.balanceMinor,
        ...(existing.note === undefined ? {} : { previousNote: existing.note }),
        replacedAt
      }]
    : [];
  return {
    errors,
    corrected: existing !== undefined,
    goal: {
      ...goal,
      checkIns: [...goal.checkIns.filter(item => item.id !== existing?.id), checkIn]
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
      correctionHistory: [...goal.correctionHistory, ...correction]
    }
  };
}

export function latestCheckIn(goal: MoneyGoal): GoalCheckIn | undefined {
  return [...goal.checkIns].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

export function remainingAmount(goal: MoneyGoal, balanceMinor: number): number {
  return goal.direction === 'increase'
    ? goal.targetBalanceMinor - balanceMinor
    : balanceMinor - goal.targetBalanceMinor;
}

export function goalTimeline(goal: MoneyGoal): GoalTimeline {
  return {
    planned: [
      { date: goal.startDate, value: goal.startingBalanceMinor },
      { date: goal.targetDate, value: goal.targetBalanceMinor }
    ],
    actual: [...goal.checkIns]
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
      .map(checkIn => ({ date: checkIn.effectiveDate, value: checkIn.balanceMinor }))
  };
}

export function goalDraftFrom(goal: MoneyGoal): GoalDraft {
  return {
    title: goal.title,
    currency: goal.currency,
    direction: goal.direction,
    startingBalance: moneyInputValue(goal.startingBalanceMinor, goal.currency),
    startDate: goal.startDate,
    targetBalance: moneyInputValue(goal.targetBalanceMinor, goal.currency),
    targetDate: goal.targetDate
  };
}
