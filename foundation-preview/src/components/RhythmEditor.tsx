import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import {
  areas,
  foundationCatalogue,
  foundationTerminologyForCategory,
  syntheticPeople,
  syntheticPersonPickerGroups
} from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type { StrengthMode, StrengthSavedWorkout } from '../domain/strength.ts';
import {
  foundationRequirementMessage,
  foundationCategoryId,
  missingRequiredFoundationCategories,
  removeFoundationLinksForCategory
} from '../domain/foundation-rhythm-associations.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import {
  rhythmDraftFrom,
  updateRhythmDraftFitnessActivity,
  validateRhythmDraft
} from '../domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors } from '../domain/rhythm-editor.ts';
import { formatRhythmSchedule } from '../domain/rhythm-schedule.ts';
import { rhythmTimeLabel } from '../domain/rhythm-schedule.ts';
import type { RhythmFrequencyRecommendation } from '../domain/rhythm-schedule.ts';
import { localDateString } from '../domain/money-goals.ts';
import { rhythmSeasonForDate } from '../domain/rhythm-seasons.ts';
import { rhythmSchedulesEqual } from '../domain/rhythm-occurrences.ts';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { formatRhythmSeasonDate } from './RhythmSeasonCard.tsx';
import { RhythmCalendarIcon } from './RhythmCalendarIcon.tsx';
import { BadgeSelectionPicker, toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { MarriageIcon } from './MarriageIcon.tsx';
import { PeopleAssociationRow, PeopleBadgeSelectionPicker } from './PeopleAssociationControls.tsx';
import { RhythmCategoryBadges } from './RhythmCategoryBadges.tsx';
import { RhythmFoundationBadges } from './RhythmFoundationBadges.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';

function emptyDraft(): RhythmDraft {
  return {
    title: '',
    description: '',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    personIds: [],
    categoryIds: [],
    schedule: { frequency: 'daily' },
    scheduleEditing: true,
    personal: false
  };
}

function RhythmSectionHeading({
  id,
  title,
  icon
}: {
  id: string;
  title: string;
  icon: 'details' | 'timing' | 'connections' | 'activity';
}) {
  return (
    <h3 id={id} className="rhythm-editor__section-heading">
      <span className="rhythm-editor__section-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" focusable="false">
          {icon === 'details' && <><path d="m14.5 5.5 4 4" /><path d="M4 20l4.8-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.8 16 4 20Z" /></>}
          {icon === 'timing' && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>}
          {icon === 'connections' && <><path d="m9.5 14.5-1.2 1.2a3.7 3.7 0 0 1-5.2-5.2l3.1-3.1a3.7 3.7 0 0 1 5.2 0" /><path d="m14.5 9.5 1.2-1.2a3.7 3.7 0 0 1 5.2 5.2l-3.1 3.1a3.7 3.7 0 0 1-5.2 0" /><path d="m8.8 15.2 6.4-6.4" /></>}
          {icon === 'activity' && <path d="M3 12h4l3-7 4 14 3-7h4" />}
        </svg>
      </span>
      <span className="rhythm-editor__section-title">{title}</span>
      <span className="rhythm-editor__section-divider" aria-hidden="true" />
    </h3>
  );
}

type RhythmEditorProps = {
  rhythm?: RhythmPreview;
  initialDraft?: RhythmDraft;
  suggestionSourceId?: string;
  recommendedFrequency?: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
  asOfDate?: string;
  people?: readonly PersonPreview[];
  peopleGroups?: readonly PersonPickerGroup[];
  hasDatedCompletionHistory?: boolean;
  savedWorkouts?: readonly StrengthSavedWorkout[];
  healthWorkoutSetting?: { mode: StrengthMode; workoutId?: string };
  onSave: (draft: RhythmDraft) => RhythmDraftErrors;
  onArchive?: (id: string) => void;
  onClose: () => void;
};

type AssociationKind = 'categories' | 'people';
type ScheduleDraftSnapshot = Pick<RhythmDraft, 'schedule' | 'scheduleEditing' | 'seasonName'>;

function accessibleScheduleDescription(schedule: NonNullable<RhythmDraft['schedule']>) {
  return formatRhythmSchedule(schedule, 'detailed').replace(/\.+$/, '');
}

function rhythmEditorScrollRegion() {
  return document.querySelector<HTMLElement>(
    '.money-goal-dialog--rhythm-editor .rhythm-editor__scroll'
  );
}

function RhythmAssociationRow({
  title,
  accessibleName,
  openerRef,
  onChoose,
  invalid = false,
  describedBy,
  children
}: {
  title: string;
  accessibleName: string;
  openerRef: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
  invalid?: boolean;
  describedBy?: string;
  children: ReactNode;
}) {
  return (
    <button
      ref={openerRef}
      type="button"
      className="rhythm-editor__association-row"
      aria-label={accessibleName}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-errormessage={describedBy}
      onClick={onChoose}
    >
      <span className="rhythm-editor__association-row-content">
        <span className="rhythm-editor__association-row-title">{title}</span>
        <span className="rhythm-editor__association-row-selection">{children}</span>
      </span>
      <span className="rhythm-editor__association-row-chevron" aria-hidden="true">›</span>
    </button>
  );
}

export function RhythmEditor({
  rhythm,
  initialDraft,
  suggestionSourceId,
  recommendedFrequency,
  frequencyGuidance,
  asOfDate,
  people = syntheticPeople,
  peopleGroups = syntheticPersonPickerGroups,
  hasDatedCompletionHistory = false,
  savedWorkouts = [],
  healthWorkoutSetting,
  onSave,
  onArchive,
  onClose
}: RhythmEditorProps) {
  const timeOptions = useRhythmTimeOptions();
  const [draft, setDraft] = useState<RhythmDraft>(() => {
    const openingDraft = initialDraft
      ? {
        ...initialDraft,
        personIds: [...initialDraft.personIds],
        categoryIds: [...initialDraft.categoryIds],
        ...(initialDraft.secondaryFoundationIds === undefined
          ? {}
          : { secondaryFoundationIds: [...initialDraft.secondaryFoundationIds] })
      }
      : rhythm
        ? rhythmDraftFrom(rhythm, rhythm.categoryIds ?? [], asOfDate, timeOptions)
        : emptyDraft();
    return openingDraft.categoryIds.includes('health') || openingDraft.healthLogCapability !== undefined
      ? {
          ...openingDraft,
          healthLogCapability: openingDraft.healthLogCapability ?? 'workout',
          healthWorkoutMode: healthWorkoutSetting?.mode ?? openingDraft.healthWorkoutMode ?? 'recommended',
          ...((healthWorkoutSetting?.workoutId ?? openingDraft.healthWorkoutId)
            ? { healthWorkoutId: healthWorkoutSetting?.workoutId ?? openingDraft.healthWorkoutId }
            : {})
        }
      : openingDraft;
  });
  const [errors, setErrors] = useState<RhythmDraftErrors>({});
  const [showArchiveConfirmation, setShowArchiveConfirmation] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] = useState(false);
  const [isChangingSchedule, setIsChangingSchedule] = useState(false);
  const [scheduleFieldsRevision, setScheduleFieldsRevision] = useState(0);
  const [activePicker, setActivePicker] = useState<AssociationKind | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [pickerFoundationSelection, setPickerFoundationSelection] = useState<string[]>([]);
  const [pendingCategoryRemoval, setPendingCategoryRemoval] = useState<typeof areas[number] | null>(null);
  const [categoryPickerFocusId, setCategoryPickerFocusId] = useState<string | null>(null);
  const categoryPickerOpenerRef = useRef<HTMLButtonElement>(null);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement>(null);
  const protectedFrequencyButtonRef = useRef<HTMLButtonElement>(null);
  const restoreProtectedFrequencyFocusRef = useRef(false);
  const focusScheduleControlRef = useRef(false);
  const scheduleDialogScrollTopRef = useRef(0);
  const scheduleFlowOpeningDraftRef = useRef<ScheduleDraftSnapshot | null>(null);
  const endDateValidationMessageRef = useRef<string | undefined>(undefined);
  const restoreFocusToPickerOpenerRef = useRef(false);
  const pickerOriginRef = useRef<AssociationKind>('categories');
  const pickerScrollTopRef = useRef(0);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const archiveConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const categoryRemovalButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingArchiveRef = useRef(false);
  const hasPreservedSeasonHistory = (rhythm?.scoring?.scheduleHistory.length ?? 0) > 1;

  useLayoutEffect(() => {
    if (activePicker === null && restoreFocusToPickerOpenerRef.current) {
      const scrollRegion = rhythmEditorScrollRegion();
      if (scrollRegion) scrollRegion.scrollTop = pickerScrollTopRef.current;
      ({
        categories: categoryPickerOpenerRef.current,
        people: peoplePickerOpenerRef.current
      })[pickerOriginRef.current]?.focus({ preventScroll: true });
      restoreFocusToPickerOpenerRef.current = false;
    }
  }, [activePicker]);

  useEffect(() => {
    if (showArchiveConfirmation) {
      const scrollRegion = rhythmEditorScrollRegion();
      if (scrollRegion) scrollRegion.scrollTop = scrollRegion.scrollHeight;
      archiveConfirmButtonRef.current?.focus({ preventScroll: true });
    } else if (wasConfirmingArchiveRef.current) {
      archiveButtonRef.current?.focus({ preventScroll: true });
    }
    wasConfirmingArchiveRef.current = showArchiveConfirmation;
  }, [showArchiveConfirmation]);

  useEffect(() => {
    if (pendingCategoryRemoval) categoryRemovalButtonRef.current?.focus({ preventScroll: true });
  }, [pendingCategoryRemoval]);

  function update<K extends keyof RhythmDraft>(field: K, value: RhythmDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => {
      const next = { ...previous };
      delete next[field];
      if (field === 'schedule') delete next.schedule;
      return next;
    });
  }

  function updateFitnessActivity(value: 'workout' | 'cardio' | 'weight') {
    const nextDraft = updateRhythmDraftFitnessActivity(draft, value);
    if (value !== 'cardio') nextDraft.healthRunTarget = null;
    const nextErrors = validateRhythmDraft(
      nextDraft,
      allFoundations,
      people.map(person => person.id),
      timeOptions
    );
    setDraft(nextDraft);
    setErrors(previous => {
      const next = { ...previous };
      for (const field of ['categoryIds', 'foundationIds', 'healthRunTarget'] as const) {
        delete next[field];
        if (nextErrors[field]) next[field] = nextErrors[field];
      }
      return next;
    });
  }
  function openPicker(kind: AssociationKind) {
    pickerScrollTopRef.current = rhythmEditorScrollRegion()?.scrollTop ?? 0;
    pickerOriginRef.current = kind;
    setCategoryPickerFocusId(null);
    setPendingCategoryRemoval(null);
    setPickerSelection(kind === 'categories'
      ? [...draft.categoryIds]
      : [...draft.personIds]);
    setPickerFoundationSelection(foundationRhythmIds(draft));
    setActivePicker(kind);
  }

  function closePicker(apply: boolean) {
    if (!activePicker) return;
    restoreFocusToPickerOpenerRef.current = true;
    if (apply) {
      if (activePicker === 'categories') {
        const categoryDraft = {
          ...draft,
          categoryIds: pickerSelection as RhythmDraft['categoryIds'],
          primaryFoundationId: pickerFoundationSelection[0] ?? null,
          secondaryFoundationIds: pickerFoundationSelection.slice(1)
        };
        const nextDraft = !draft.categoryIds.includes('health')
          && categoryDraft.categoryIds.includes('health')
          && categoryDraft.healthLogCapability == null
          ? updateRhythmDraftFitnessActivity(categoryDraft, 'workout')
          : categoryDraft;
        const nextCategoryErrors = validateRhythmDraft(
          nextDraft,
          undefined,
          people.map(person => person.id),
          timeOptions
        );
        setDraft(nextDraft);
        setErrors(previous => {
          if (!previous.categoryIds && !previous.foundationIds) return previous;
          const next = { ...previous };
          if (nextCategoryErrors.categoryIds) next.categoryIds = nextCategoryErrors.categoryIds;
          else delete next.categoryIds;
          if (nextCategoryErrors.foundationIds) next.foundationIds = nextCategoryErrors.foundationIds;
          else delete next.foundationIds;
          return next;
        });
      } else {
        update('personIds', pickerSelection as RhythmDraft['personIds']);
      }
    }
    setPendingCategoryRemoval(null);
    setActivePicker(null);
  }

  function togglePickerItem(id: string) {
    if (activePicker === 'categories'
      && (pickerFoundationSelection.includes(id) || allFoundations.some(foundation => foundation.id === id))) {
      setPickerFoundationSelection(current => current.includes(id)
        ? current.filter(selected => selected !== id)
        : [...current, id]);
      return;
    }
    if (activePicker === 'categories' && pickerSelection.includes(id)) {
      const category = areas.find(area => area.id === id);
      if (category) {
        const affected = removeFoundationLinksForCategory({
          primaryFoundationId: pickerFoundationSelection[0] ?? null,
          secondaryFoundationIds: pickerFoundationSelection.slice(1)
        }, category.id);
        if (affected.removedIds.length > 0) {
          setPendingCategoryRemoval(category);
          return;
        }
      }
    }
    setPickerSelection(current => current.includes(id)
      ? current.filter(selected => selected !== id)
      : [...current, id]);
  }

  function confirmCategoryRemoval() {
    if (!pendingCategoryRemoval) return;
    const affected = removeFoundationLinksForCategory({
      primaryFoundationId: pickerFoundationSelection[0] ?? null,
      secondaryFoundationIds: pickerFoundationSelection.slice(1)
    }, pendingCategoryRemoval.id);
    setPickerSelection(current => current.filter(id => id !== pendingCategoryRemoval.id));
    setPickerFoundationSelection([
      ...(affected.primaryFoundationId ? [affected.primaryFoundationId] : []),
      ...affected.secondaryFoundationIds
    ]);
    setCategoryPickerFocusId(pendingCategoryRemoval.id);
    setPendingCategoryRemoval(null);
  }

  function cancelCategoryRemoval() {
    if (!pendingCategoryRemoval) return;
    setCategoryPickerFocusId(pendingCategoryRemoval.id);
    setPendingCategoryRemoval(null);
  }

  function selectPickerGroup(ids: readonly string[]) {
    setPickerSelection(current => toggleBadgeGroup(current, ids));
  }

  function handleDialogEscape() {
    if (pendingCategoryRemoval) cancelCategoryRemoval();
    else if (activePicker) closePicker(false);
    else onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endDateValidationMessage = endDateValidationMessageRef.current;
    if (endDateValidationMessage) {
      setErrors(previous => ({
        ...previous,
        schedule: endDateValidationMessage
      }));
      return;
    }
    const originalSchedule = draft.originalSchedule;
    const scheduleChanged = draft.schedule !== undefined && originalSchedule !== undefined
      ? !rhythmSchedulesEqual(draft.schedule, originalSchedule)
      : draft.schedule !== undefined;
    if (rhythm && (hasDatedCompletionHistory || hasPreservedSeasonHistory)
      && scheduleChanged && draft.schedule) {
      const nextErrors = validateRhythmDraft(draft, undefined, people.map(person => person.id), timeOptions);
      if (draft.healthLogCapability === 'workout'
        && draft.healthWorkoutMode === 'specific'
        && !savedWorkouts.some(workout => workout.id === draft.healthWorkoutId)) {
        nextErrors.healthWorkoutId = 'Select an available saved workout.';
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        if (scheduleFlowOpeningDraftRef.current === null) {
          scheduleFlowOpeningDraftRef.current = {
            ...(draft.originalSchedule === undefined ? {} : { schedule: draft.originalSchedule }),
            ...(draft.scheduleEditing === undefined ? {} : { scheduleEditing: draft.scheduleEditing }),
            ...(draft.seasonName === undefined ? {} : { seasonName: draft.seasonName })
          };
        }
        setShowScheduleConfirmation(true);
      }
      return;
    }
    const nextErrors = onSave(draft);
    setErrors(nextErrors);
  }

  function confirmScheduleChange() {
    const nextErrors = onSave({
      ...draft,
      ...(draft.seasonName === undefined ? {} : { seasonName: draft.seasonName.trim() })
    });
    setErrors(nextErrors);
    setShowScheduleConfirmation(false);
    if (Object.keys(nextErrors).length > 0) saveButtonRef.current?.focus();
  }

  function cancelScheduleChange() {
    setShowScheduleConfirmation(false);
    setIsChangingSchedule(false);
    setScheduleFieldsRevision(revision => revision + 1);
    restoreProtectedFrequencyFocusRef.current = true;
    const openingDraft = scheduleFlowOpeningDraftRef.current;
    setDraft(previous => {
      const next = { ...previous, scheduleEditing: openingDraft?.scheduleEditing ?? false };
      if (openingDraft?.schedule === undefined) delete next.schedule;
      else next.schedule = openingDraft.schedule;
      if (openingDraft?.seasonName === undefined) delete next.seasonName;
      else next.seasonName = openingDraft.seasonName;
      return next;
    });
    scheduleFlowOpeningDraftRef.current = null;
    setErrors(current => {
      const next = { ...current };
      delete next.schedule;
      delete next.seasonName;
      return next;
    });
  }

  function fieldError(field: keyof RhythmDraft | 'foundationIds') {
    return errors[field]
      ? <span className="goal-field-error" id={`rhythm-error-${field}`}>{errors[field]}</span>
      : null;
  }

  const timeValue = timeOptions.find(option => option.label === draft.timeLabel)?.value ?? '';
  const effectiveSchedule = draft.originalSchedule ?? draft.schedule;
  const hasProtectedScheduleHistory = Boolean(rhythm && (hasDatedCompletionHistory || hasPreservedSeasonHistory));
  const showCadenceDescription = Boolean(
    rhythm && hasProtectedScheduleHistory && draft.originalSchedule && !isChangingSchedule
  );
  useLayoutEffect(() => {
    if (restoreProtectedFrequencyFocusRef.current) {
      const scrollRegion = rhythmEditorScrollRegion();
      if (scrollRegion) scrollRegion.scrollTop = scheduleDialogScrollTopRef.current;
      const returnFocusTarget = protectedFrequencyButtonRef.current
        ?? scrollRegion?.querySelector<HTMLButtonElement>('.rhythm-schedule-fields__frequency .rhythm-select__trigger');
      returnFocusTarget?.focus({ preventScroll: true });
      restoreProtectedFrequencyFocusRef.current = false;
    }
    if (!showCadenceDescription && focusScheduleControlRef.current) {
      const scrollRegion = rhythmEditorScrollRegion();
      const scheduleControl = scrollRegion?.querySelector<HTMLButtonElement>(
        '.rhythm-schedule-fields .rhythm-select__trigger'
      );
      if (scrollRegion && scheduleControl) {
        scrollRegion.scrollTop = scheduleDialogScrollTopRef.current;
        scheduleControl.focus({ preventScroll: true });
        const dialogBounds = scrollRegion.getBoundingClientRect();
        const controlBounds = scheduleControl.getBoundingClientRect();
        if (controlBounds.top < dialogBounds.top) {
          scrollRegion.scrollTop -= dialogBounds.top - controlBounds.top;
        } else if (controlBounds.bottom > dialogBounds.bottom) {
          scrollRegion.scrollTop += controlBounds.bottom - dialogBounds.bottom;
        }
      }
      focusScheduleControlRef.current = false;
    }
  }, [showCadenceDescription, showScheduleConfirmation]);
  const originalSchedule = draft.originalSchedule;
  const currentScheduleLabel = originalSchedule
    ? formatRhythmSchedule(originalSchedule, 'compact')
    : '';
  const originalSeason = asOfDate
    ? rhythmSeasonForDate(draft.originalScoring?.scheduleHistory ?? [], asOfDate)
    : draft.originalScoring?.scheduleHistory.at(-1);
  const originalTimeLabel = originalSeason?.kind === 'scheduled' && originalSeason.timeOfDay
    ? rhythmTimeLabel(originalSeason.timeOfDay, timeOptions)
    : rhythm?.timeOfDay
      ? rhythmTimeLabel(rhythm.timeOfDay, timeOptions)
      : rhythm?.timeLabel ?? 'Anytime';
  const showScheduleTimeComparison = originalTimeLabel !== draft.timeLabel;
  const scheduleEffectiveDate = asOfDate ?? localDateString(new Date());
  const selectedCategories = areas
    .filter(area => draft.categoryIds.includes(area.id));
  const selectedPeople = people
    .filter(person => draft.personIds.includes(person.id));
  const selectedFoundationIds = [
    ...(draft.primaryFoundationId ? [draft.primaryFoundationId] : []),
    ...(draft.secondaryFoundationIds ?? [])
  ];
  const allFoundations = foundationCatalogue;
  const missingRequiredCategories = missingRequiredFoundationCategories(
    draft.categoryIds,
    selectedFoundationIds,
    allFoundations
  );
  const categoryValidationField = errors.categoryIds ? 'categoryIds' : 'foundationIds';
  const categoryValidationMessage = errors.categoryIds ?? errors.foundationIds;
  const needsScheduleRemediation = Boolean(
    rhythm && draft.originalSchedule === undefined && draft.schedule === undefined
  );
  const invalidFoundationLinks = selectedFoundationIds.filter(id => {
    const ownerCategoryId = foundationCategoryId(id, allFoundations);
    return ownerCategoryId === undefined || !draft.categoryIds.includes(ownerCategoryId);
  });
  const associationRhythm: RhythmPreview = {
    id: rhythm?.id ?? 'rhythm-editor-draft',
    title: draft.title || 'Rhythm draft',
    automation: rhythm?.automation ?? 'manual',
    status: rhythm?.status ?? 'Not confirmed',
    categoryIds: draft.categoryIds,
    primaryFoundationId: draft.primaryFoundationId ?? null,
    secondaryFoundationIds: draft.secondaryFoundationIds ?? []
  };
  const selectedFoundationGroups = areas.map(area => {
    const categoryFoundations = allFoundations.filter(foundation =>
      foundationCategoryId(foundation.id, allFoundations) === area.id
        && selectedFoundationIds.includes(foundation.id)
    );
    return {
      area,
      foundations: categoryFoundations,
      rhythm: {
        ...associationRhythm,
        categoryIds: [area.id],
        primaryFoundationId: categoryFoundations[0]?.id ?? null,
        secondaryFoundationIds: categoryFoundations.slice(1).map(foundation => foundation.id)
      } satisfies RhythmPreview
    };
  }).filter(group => group.foundations.length > 0);
  const foundationLinksNeedingReview = selectedFoundationIds
    .filter(id => {
      const ownerCategoryId = foundationCategoryId(id, allFoundations);
      return ownerCategoryId === undefined || !draft.categoryIds.includes(ownerCategoryId);
    })
    .map(id => {
      const foundation = allFoundations.find(item => item.id === id);
      return {
        id,
        label: foundation
          ? `${foundation.name} (${foundation.category} category not selected)`
          : `Unresolved Foundation reference: ${id}`
      };
    });
  const pickerFoundationLinksNeedingReview = pickerFoundationSelection
    .filter(id => {
      const ownerCategoryId = foundationCategoryId(id, allFoundations);
      return ownerCategoryId === undefined || !pickerSelection.includes(ownerCategoryId);
    })
    .map(id => {
      const foundation = allFoundations.find(item => item.id === id);
      return {
        id,
        label: foundation
          ? `${foundation.name} (${foundation.category} category not selected)`
          : `Unresolved Foundation reference: ${id}`
      };
    });
  const associationName = (title: string, selected: readonly string[], emptyState: string) => {
    const prefix = `Choose ${title.toLowerCase()}`;
    if (selected.length === 0) return emptyState;
    const selectedNames = selected.length === 1
      ? selected[0]!
      : `${selected.slice(0, -1).join(', ')} and ${selected.at(-1)}`;
    return `${prefix}, ${selectedNames}`;
  };
  const foundationChoicesForCategory = (categoryId: string) => allFoundations.filter(foundation =>
    foundationCategoryId(foundation.id, allFoundations) === categoryId
    && ((foundation.lifecycle === 'active' && foundation.capabilities.rhythms)
      || pickerFoundationSelection.includes(foundation.id))
  );
  const categoryHasFoundationChoices = (categoryId: string) =>
    allFoundations.some(foundation =>
      foundationCategoryId(foundation.id, allFoundations) === categoryId
      && foundation.lifecycle === 'active'
      && foundation.capabilities.rhythms
    );
  const foundationChoiceLabel = (foundation: FoundationPreview) =>
    foundation.lifecycle === 'active' && foundation.capabilities.rhythms
      ? foundation.name
      : `${foundation.name} (inactive; retained)`;
  const foundationChoiceGroup = (category: typeof areas[number]) => {
    if (!categoryHasFoundationChoices(category.id)) return null;
    const term = foundationTerminologyForCategory(category.id);
    const choices = foundationChoicesForCategory(category.id);
    return (
      <div className="rhythm-association-picker__category-foundations">
        <p>Choose one or more {term.plural.toLowerCase()} for {category.label}.</p>
        <div role="group" aria-label={`${category.label} ${term.plural}, choose one or more`}>
          <div className="rhythm-association-picker__foundation-options">
            {choices.map(foundation => {
              const selected = pickerFoundationSelection.includes(foundation.id);
              const label = foundationChoiceLabel(foundation);
              return (
                <button
                  key={foundation.id}
                  type="button"
                  className="rhythm-association-picker__option"
                  aria-label={label}
                  aria-pressed={selected}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => togglePickerItem(foundation.id)}
                >
                  <span className="rhythm-association-picker__badge">{renderFoundationBadge(foundation)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };
  const renderCategoryBadge = (area: typeof areas[number]) => (
    <>
      <span className="rhythm-association-picker__category-icon" aria-hidden="true"><AreaIcon id={area.id} /></span>
      <span>{area.label}</span>
    </>
  );
  const renderFoundationBadge = (foundation: FoundationPreview) => (
    <>
      <span className="rhythm-association-picker__foundation-icon" aria-hidden="true">
        <MarriageIcon group="foundations" id={foundation.iconId ?? foundation.id} />
      </span>
      <span>{foundation.name}</span>
    </>
  );
  const timeOfDayField = (
    <div className="goal-field rhythm-schedule-fields__time">
      <label>Time of day</label>
      <StyledSelect
        label="Time of day"
        options={timeOptions}
        value={timeValue}
        describedBy={errors.timeLabel ? 'rhythm-error-timeLabel' : undefined}
        invalid={Boolean(errors.timeLabel)}
        onChange={value => {
          const option = timeOptions.find(item => item.value === value);
          if (option) update('timeLabel', option.label);
        }}
      />
      {fieldError('timeLabel')}
    </div>
  );
  const protectedFrequencyField = (
    <div className="goal-field rhythm-editor__protected-frequency">
      <label htmlFor="rhythm-protected-frequency">Frequency</label>
      <button
        ref={protectedFrequencyButtonRef}
        id="rhythm-protected-frequency"
        type="button"
        className="rhythm-editor__protected-frequency-button"
        aria-label={`Change frequency, currently ${currentScheduleLabel}`}
        onClick={openProtectedScheduleEditor}
      >
        <span>{currentScheduleLabel}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  function openProtectedScheduleEditor() {
    scheduleDialogScrollTopRef.current = rhythmEditorScrollRegion()?.scrollTop ?? 0;
    scheduleFlowOpeningDraftRef.current = {
      ...(draft.originalSchedule === undefined
        ? draft.schedule === undefined ? {} : { schedule: draft.schedule }
        : { schedule: draft.originalSchedule }),
      ...(draft.scheduleEditing === undefined ? {} : { scheduleEditing: draft.scheduleEditing }),
      ...(draft.seasonName === undefined ? {} : { seasonName: draft.seasonName })
    };
    focusScheduleControlRef.current = true;
    setIsChangingSchedule(true);
    setDraft(previous => ({
      ...previous,
      ...(previous.schedule === undefined && effectiveSchedule ? { schedule: effectiveSchedule } : {}),
      scheduleEditing: true
    }));
    setErrors(previous => {
      const next = { ...previous };
      delete next.schedule;
      return next;
    });
  }

  return (
    <>
    <MoneyGoalDialog
      title={rhythm ? 'Edit Rhythm' : 'Add Rhythm'}
      initialFocusId="money-goal-dialog-title"
      closeLabel="Close Rhythm editor"
      dialogClassName="money-goal-dialog--rhythm-editor"
      phoneFullScreen
      inert={activePicker !== null}
      onClose={handleDialogEscape}
    >
      <form className="rhythm-editor" onSubmit={submit} noValidate>
        <div className="rhythm-editor__scroll">
        {suggestionSourceId && (
          <p className="money-goal-dialog__intro">
            Suggested Rhythm draft. Nothing is saved until you choose Save. The catalogue hint is only a recommendation.
          </p>
        )}
        <section className="rhythm-editor__section" aria-labelledby="rhythm-details-heading">
          <RhythmSectionHeading id="rhythm-details-heading" title="Details" icon="details" />
          <div className="goal-field rhythm-editor__title-field">
            <label htmlFor="rhythm-title">Title</label>
            <input
              id="rhythm-title"
              maxLength={80}
              value={draft.title}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'rhythm-error-title' : undefined}
              onChange={event => update('title', event.currentTarget.value)}
            />
            {fieldError('title')}
          </div>
          <div className="goal-field rhythm-editor__description-field">
            <label htmlFor="rhythm-description">Description (optional)</label>
            <textarea
              id="rhythm-description"
              rows={2}
              maxLength={1000}
              value={draft.description}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'rhythm-error-description' : undefined}
              onChange={event => update('description', event.currentTarget.value)}
            />
            {fieldError('description')}
          </div>
        </section>

        <section className="rhythm-editor__section" aria-labelledby="rhythm-timing-heading">
          <RhythmSectionHeading id="rhythm-timing-heading" title="Timing" icon="timing" />
          {needsScheduleRemediation && (
            <p className="rhythm-editor__legacy-frequency" role="status">
              Current frequency: “{rhythm?.cadence ?? 'Not recorded'}”. Choose a supported frequency and complete its details to save; this value does not specify a complete schedule.
            </p>
          )}
          <RhythmScheduleFields
            key={scheduleFieldsRevision}
            schedule={draft.schedule ?? effectiveSchedule}
            error={errors.schedule}
            onChange={schedule => update('schedule', schedule)}
            onEndDateValidationChange={message => {
              endDateValidationMessageRef.current = message;
            }}
            requireExplicitChoices={initialDraft !== undefined || draft.originalSchedule === undefined}
            showScheduleControls={!showCadenceDescription}
            endDatePlacement="after-time"
            {...(recommendedFrequency ? { initialFrequency: recommendedFrequency } : {})}
            {...(frequencyGuidance ? { frequencyGuidance } : {})}
          >
            {showCadenceDescription
              ? <>{protectedFrequencyField}{timeOfDayField}</>
              : timeOfDayField}
          </RhythmScheduleFields>
        </section>

        <section className="rhythm-editor__section" aria-labelledby="rhythm-connections-heading">
          <RhythmSectionHeading id="rhythm-connections-heading" title="Connections" icon="connections" />
          <section className="rhythm-editor__association" aria-label="Associations">
          <PeopleAssociationRow
            selectedPeople={selectedPeople}
            openerRef={peoplePickerOpenerRef}
            onChoose={() => openPicker('people')}
          />
          <div className={`rhythm-editor__category-field${categoryValidationMessage
            ? ' rhythm-editor__category-field--invalid'
            : ''}`}>
            <RhythmAssociationRow
              title="Categories"
              accessibleName={associationName('categories', selectedCategories.map(category => category.label), 'Choose categories')}
              openerRef={categoryPickerOpenerRef}
              onChoose={() => openPicker('categories')}
              invalid={Boolean(categoryValidationMessage)}
              {...(categoryValidationMessage
                ? { describedBy: `rhythm-error-${categoryValidationField}` }
                : {})}
            >
              {selectedCategories.length > 0 ? (
                <span className="rhythm-editor__association-category-list">
                  {selectedCategories.map(category => {
                    const group = selectedFoundationGroups.find(item => item.area.id === category.id);
                    const categoryRhythm = {
                      ...associationRhythm,
                      categoryIds: [category.id]
                    };
                    return (
                      <span
                        key={category.id}
                        className="rhythm-editor__association-category-row"
                        role="group"
                        aria-label={`${category.label} category${group ? ' and linked Foundations' : ''}`}
                      >
                        <RhythmCategoryBadges rhythm={categoryRhythm} itemsOnly presentation="static" />
                        {group && (
                          <RhythmFoundationBadges
                            rhythm={group.rhythm}
                            foundations={allFoundations}
                            presentation="static"
                            showAll
                          />
                        )}
                      </span>
                    );
                  })}
                </span>
              ) : <span className="rhythm-editor__association-empty">Choose categories</span>}
            </RhythmAssociationRow>
            {categoryValidationMessage ? (
              <p
                className="goal-field-error rhythm-editor__category-error"
                id={`rhythm-error-${categoryValidationField}`}
                role="alert"
              >
                {categoryValidationMessage}
              </p>
            ) : missingRequiredCategories.length > 0 && (
              <div className="rhythm-editor__foundation-requirement" role="status">
                <p>
                  {foundationRequirementMessage(missingRequiredCategories)}
                  {' '}Choose matching selections in Categories before saving.
                </p>
              </div>
            )}
          </div>
          </section>
          {(draft.categoryIds.includes('health') || draft.healthLogCapability !== undefined) && (
            <section
              className="rhythm-editor__section rhythm-editor__fitness-activity"
              aria-labelledby="rhythm-fitness-activity-heading"
            >
              <RhythmSectionHeading id="rhythm-fitness-activity-heading" title="Fitness activity" icon="activity" />
              <div className="rhythm-editor__fitness-activity-fields" role="group" aria-label="Health & Fitness logging">
              <div className="goal-field">
                <label>Activity</label>
                <StyledSelect
                  label="Fitness activity"
                  value={draft.healthLogCapability ?? 'workout'}
                  options={[
                    { value: 'workout', label: 'Workout' },
                    { value: 'cardio', label: 'Run' },
                    { value: 'weight', label: 'Weigh-in' }
                  ]}
                  onChange={value => {
                    if (value !== 'workout' && value !== 'cardio' && value !== 'weight') return;
                    updateFitnessActivity(value);
                  }}
                />
              </div>
              {draft.healthLogCapability === 'workout' && (
                <>
                  <div className="goal-field">
                    <label>Workout</label>
                    <StyledSelect
                      label="Workout"
                      value={draft.healthWorkoutMode ?? 'recommended'}
                      options={[
                        { value: 'recommended', label: 'Recommended Workout' },
                        { value: 'specific', label: 'Specific saved workout' },
                        { value: 'custom', label: 'Custom workout' }
                      ]}
                      onChange={value => {
                        if (value === 'recommended' || value === 'specific' || value === 'custom') {
                          update('healthWorkoutMode', value);
                        }
                      }}
                    />
                  </div>
                  {draft.healthWorkoutMode === 'specific' && (
                    <div className="goal-field">
                      <label>Saved workout</label>
                      <StyledSelect
                        label="Saved workout"
                        value={draft.healthWorkoutId ?? ''}
                        invalid={!savedWorkouts.some(workout => workout.id === draft.healthWorkoutId)}
                        options={[
                          { value: '', label: 'Select a saved workout' },
                          ...(draft.healthWorkoutId && !savedWorkouts.some(workout => workout.id === draft.healthWorkoutId)
                            ? [{ value: draft.healthWorkoutId, label: 'Saved workout unavailable' }]
                            : []),
                          ...savedWorkouts.map(workout => ({ value: workout.id, label: workout.name }))
                        ]}
                        onChange={value => update('healthWorkoutId', value)}
                      />
                      {fieldError('healthWorkoutId')}
                    </div>
                  )}
                </>
              )}
              {draft.healthLogCapability === 'cardio' && (
                <div className="rhythm-editor__fitness-run-target">
                  <div className="goal-field">
                    <label>Target distance (optional)</label>
                    <input
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.1"
                      value={draft.healthRunTarget?.distance ?? ''}
                      aria-describedby={errors.healthRunTarget ? 'rhythm-error-healthRunTarget' : undefined}
                      aria-invalid={Boolean(errors.healthRunTarget)}
                      onChange={event => {
                        const value = event.currentTarget.value;
                        if (!value) {
                          update('healthRunTarget', null);
                          return;
                        }
                        update('healthRunTarget', {
                          distance: Number(value),
                          unit: draft.healthRunTarget?.unit ?? 'mi'
                        });
                      }}
                    />
                    {errors.healthRunTarget && <span className="goal-field-error" id="rhythm-error-healthRunTarget">
                      {errors.healthRunTarget}
                    </span>}
                  </div>
                  <div className="goal-field">
                    <label>Distance unit</label>
                    <StyledSelect
                      label="Distance unit"
                      value={draft.healthRunTarget?.unit ?? 'mi'}
                      options={[
                        { value: 'mi', label: 'Miles' },
                        { value: 'km', label: 'Kilometers' }
                      ]}
                      onChange={value => {
                        if (value !== 'mi' && value !== 'km') return;
                        if (draft.healthRunTarget) {
                          update('healthRunTarget', { ...draft.healthRunTarget, unit: value });
                        }
                      }}
                    />
                  </div>
                </div>
              )}
              </div>
            </section>
          )}
          {foundationLinksNeedingReview.length > 0 && (
            <p className="rhythm-editor__association-unavailable">
              Existing Foundation links that are unresolved or outside the selected categories are preserved. Review or remove them in Choose categories.
            </p>
          )}
        </section>
        <div className="rhythm-editor__association-errors">
          {fieldError('personIds')}
          {invalidFoundationLinks.some(id => allFoundations.some(foundation => foundation.id === id)) && (
            <p className="goal-field-error" role="status">
              Some existing Foundation or Practice links need their matching Category selected or must be explicitly removed.
            </p>
          )}
        </div>

        {errors.form && <p className="goal-form-error-summary" role="alert">{errors.form}</p>}
        {Object.keys(errors).some(field => field !== 'form') && (
          <p className="goal-form-error-summary" role="alert">Review the highlighted Rhythm fields.</p>
        )}
        {showArchiveConfirmation && rhythm && onArchive && (
          <section
            className="rhythm-editor__archive-confirmation"
            role="alertdialog"
            aria-labelledby="rhythm-archive-confirmation-title"
            aria-describedby="rhythm-archive-confirmation-description"
          >
            <h3 id="rhythm-archive-confirmation-title">Archive {rhythm.title}?</h3>
            <p id="rhythm-archive-confirmation-description">
              This Rhythm will leave active Today and category lists. Its identity, associations, and completion history will be retained.
            </p>
            <div className="money-goal-dialog__actions">
              <button
                ref={archiveConfirmButtonRef}
                type="button"
                className="rhythm-editor__archive-confirm"
                aria-label={`Confirm archive ${rhythm.title}`}
                onClick={() => onArchive(rhythm.id)}
              >
                Archive rhythm
              </button>
              <button
                type="button"
                className="btn mini ghost"
                onClick={() => setShowArchiveConfirmation(false)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
        </div>
        <div className="rhythm-editor__action-row">
          <div className="money-goal-dialog__actions rhythm-editor__primary-actions">
            <button ref={saveButtonRef} type="submit" className="btn mini">Save</button>
            <button type="button" className="btn mini ghost" onClick={onClose}>Cancel</button>
          </div>
          {rhythm && onArchive && (
            <button
              ref={archiveButtonRef}
              type="button"
              className="rhythm-editor__archive-button"
              aria-label={`Archive ${rhythm.title}`}
              onClick={() => setShowArchiveConfirmation(true)}
            >
              Archive
            </button>
          )}
        </div>
      </form>
      {showScheduleConfirmation && rhythm && draft.schedule && (
        <MoneyGoalDialog
          title="Change schedule"
          titleId="rhythm-schedule-confirmation-title"
          labelledBy="rhythm-schedule-confirmation-title"
          initialFocusId="rhythm-season-label"
          closeLabel="Cancel schedule change"
          dialogClassName="money-goal-dialog--schedule-confirmation"
          onClose={cancelScheduleChange}
        >
          <section className="rhythm-editor__schedule-confirmation">
            <div
              className="rhythm-editor__schedule-comparison"
              role="group"
               aria-label={`Schedule comparison. Current: ${originalSchedule ? accessibleScheduleDescription(originalSchedule) : rhythm?.cadence ?? 'Schedule unavailable'}${showScheduleTimeComparison ? `, ${originalTimeLabel}` : ''}. New: ${accessibleScheduleDescription(draft.schedule)}${showScheduleTimeComparison ? `, ${draft.timeLabel}` : ''}.`}
            >
              <div className="rhythm-editor__schedule-side">
                <span>Current</span>
                <strong>
                  {originalSchedule
                    ? formatRhythmSchedule(originalSchedule, 'compact')
                    : rhythm?.cadence ?? 'Schedule unavailable'}
                </strong>
                {showScheduleTimeComparison && <small>{originalTimeLabel}</small>}
              </div>
              <span className="rhythm-editor__schedule-arrow" aria-hidden="true">→</span>
              <div className="rhythm-editor__schedule-side rhythm-editor__schedule-side--new">
                <span>New</span>
                <strong>{formatRhythmSchedule(draft.schedule, 'compact')}</strong>
                {showScheduleTimeComparison && <small>{draft.timeLabel}</small>}
              </div>
            </div>
            <p className="rhythm-editor__schedule-effective">
              <RhythmCalendarIcon />
              <strong>Starts today</strong>
              <span>{formatRhythmSeasonDate(scheduleEffectiveDate)}</span>
            </p>
            <p className="rhythm-editor__schedule-history-note">Earlier logs keep their original schedule.</p>
            <div className="goal-field">
              <label htmlFor="rhythm-season-label">Season name (optional)</label>
              <input
                id="rhythm-season-label"
                maxLength={80}
                value={draft.seasonName ?? ''}
                onChange={event => update('seasonName', event.currentTarget.value)}
              />
            </div>
            <div className="money-goal-dialog__actions">
              <button type="button" className="btn mini" onClick={confirmScheduleChange}>Apply</button>
              <button type="button" className="btn mini ghost" onClick={cancelScheduleChange}>Cancel</button>
            </div>
          </section>
        </MoneyGoalDialog>
      )}
    </MoneyGoalDialog>
    {activePicker && (
      <MoneyGoalDialog
        {...(activePicker === 'categories' ? { closeLabel: 'Close category picker' } : {})}
        labelledBy={activePicker === 'categories' && pendingCategoryRemoval
          ? 'rhythm-category-removal-title'
          : 'rhythm-association-picker-title'}
        initialFocusId={categoryPickerFocusId ?? (
          pendingCategoryRemoval ? 'rhythm-category-removal-confirm' : 'rhythm-association-picker-title'
        )}
        stopEscapePropagation
        portalToBody
        phoneFullScreen={activePicker === 'categories'}
        dialogClassName={`money-goal-dialog--association-picker${activePicker === 'categories' ? ' money-goal-dialog--category-picker' : ''}`}
        onClose={() => closePicker(false)}
      >
        {activePicker === 'categories' && pendingCategoryRemoval ? (
          <section
            className="rhythm-association-picker rhythm-association-picker__confirmation"
            role="group"
            aria-labelledby="rhythm-category-removal-title"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cancelCategoryRemoval();
              }
            }}
          >
            <h3 id="rhythm-category-removal-title">Remove {pendingCategoryRemoval.label}?</h3>
            <p>
              This also unlinks {(() => {
                const names = removeFoundationLinksForCategory({
                  primaryFoundationId: pickerFoundationSelection[0] ?? null,
                  secondaryFoundationIds: pickerFoundationSelection.slice(1)
                }, pendingCategoryRemoval.id).removedIds
                  .map(id => allFoundations.find(foundation => foundation.id === id)?.name)
                  .filter((name): name is string => name !== undefined);
                return names.length === 1
                  ? names[0]
                  : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
              })()}. Your rhythm and logged moments stay saved.
            </p>
            <div className="money-goal-dialog__actions rhythm-association-picker__actions">
              <button
                ref={categoryRemovalButtonRef}
                id="rhythm-category-removal-confirm"
                type="button"
                className="btn mini"
                onClick={confirmCategoryRemoval}
              >
                Remove
              </button>
              <button type="button" className="btn mini ghost" onClick={cancelCategoryRemoval}>
                Cancel
              </button>
            </div>
          </section>
        ) : activePicker === 'categories' ? (
          <BadgeSelectionPicker
            title="Choose categories"
            description="Choose categories, then their Practices or Foundations."
            items={areas}
            selectedIds={pickerSelection}
            getLabel={area => area.label}
            renderBadge={renderCategoryBadge}
            renderSelectedItemContent={foundationChoiceGroup}
            unavailableSelectedItems={pickerFoundationLinksNeedingReview}
            unavailableGroupLabel="Existing Foundation links needing review"
            getUnavailableItemLabel={item => `Remove existing Foundation link ${item.label}`}
            unavailableItemType="Foundation"
            doneLabel="Apply"
            focusItemId={categoryPickerFocusId}
            onToggle={togglePickerItem}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        ) : activePicker === 'people' ? (
          <PeopleBadgeSelectionPicker
            people={people}
            selectedIds={pickerSelection.filter((id): id is PersonId =>
              people.some(person => person.id === id)
            )}
            onToggle={id => togglePickerItem(id)}
            onToggleGroup={selectPickerGroup}
            groups={peopleGroups}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        ) : null}
      </MoneyGoalDialog>
    )}
    </>
  );
}
