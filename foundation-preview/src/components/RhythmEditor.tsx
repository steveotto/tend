import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import {
  areas,
  foundationCatalogue,
  foundationTerminologyForCategory,
  syntheticPeople,
  syntheticPersonPickerGroups
} from '../domain/preview-data.ts';
import type { CategoryId, FoundationPreview, PersonId, PersonPickerGroup, PersonPreview } from '../domain/preview-data.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import type {
  StrengthRhythmMode,
  StrengthSavedWorkout
} from '../domain/strength.ts';
import {
  foundationRequirementMessage,
  foundationCategoryId,
  missingRequiredFoundationCategories,
  removeFoundationLinksForCategory
} from '../domain/foundation-rhythm-associations.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import {
  normalizeRhythmPersonIds,
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
import { useAreaAvailability } from './CategoryAvailabilityContext.tsx';
import {
  isCategoryEnabled,
  selectAvailableCategories,
  selectAvailableCategoryIds,
  selectAvailableFoundationIds,
  selectCategoryAssociationsForValidation
} from '../domain/category-availability.ts';
import { RhythmFoundationBadges } from './RhythmFoundationBadges.tsx';
import { useRhythmTimeOptions } from './TimeBlocksContext.tsx';
import { CheckboxTileOptions } from './CheckboxTileOptions.tsx';
import { PersonLinkIcon } from './PersonLinkIcon.tsx';

function mergePickerSelection(
  existingIds: readonly string[],
  selectedIds: readonly string[],
  isAvailable: (id: string) => boolean
): string[] {
  const selectedIdSet = new Set(selectedIds);
  const remainingSelectedIds = new Set(selectedIds.filter(isAvailable));
  const mergedIds = existingIds.flatMap(id => {
    if (!isAvailable(id)) return selectedIdSet.has(id) ? [id] : [];
    if (!remainingSelectedIds.delete(id)) return [];
    return [id];
  });
  for (const id of selectedIds) {
    if (isAvailable(id) && remainingSelectedIds.delete(id)) mergedIds.push(id);
  }
  return mergedIds;
}

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
    personal: false,
    alsoLogConnection: false,
    alsoLogConnectionExplicit: false
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
        {icon === 'connections'
          ? <PersonLinkIcon />
          : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" focusable="false">
              {icon === 'details' && <><path d="m14.5 5.5 4 4" /><path d="M4 20l4.8-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.8 16 4 20Z" /></>}
              {icon === 'timing' && <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>}
              {icon === 'activity' && <path d="M3 12h4l3-7 4 14 3-7h4" />}
            </svg>
          )}
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
  healthWorkoutSetting?: Pick<StrengthRhythmMode, 'mode' | 'workoutId' | 'rotationHistory'>;
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
  const availability = useAreaAvailability();
  const savedRotationVersion = healthWorkoutSetting?.rotationHistory?.at(-1);
  const categoryPreferences = availability.categoryPreferences;
  const availableCategories = selectAvailableCategories(categoryPreferences);
  const availableCategoryIds = selectAvailableCategoryIds(categoryPreferences);
  const availableFoundationIds = selectAvailableFoundationIds(availability, foundationCatalogue);
  const timeOptions = useRhythmTimeOptions();
  const [draft, setDraft] = useState<RhythmDraft>(() => {
    const openingDraft = initialDraft
      ? {
        ...initialDraft,
        personIds: normalizeRhythmPersonIds(initialDraft.personIds),
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
          healthWorkoutRotationWorkoutIds: [
            ...(openingDraft.healthWorkoutRotationWorkoutIds
              ?? healthWorkoutSetting?.rotationHistory?.at(-1)?.workoutIds
              ?? [])
          ],
          healthWorkoutRotationAdvanceMode: openingDraft.healthWorkoutRotationAdvanceMode
            ?? healthWorkoutSetting?.rotationHistory?.at(-1)?.advanceMode
            ?? 'after-completion',
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

  function validateDraftForAvailableCategories(candidate: RhythmDraft) {
    const associations = selectCategoryAssociationsForValidation(
      categoryPreferences,
      candidate.categoryIds,
      foundationRhythmIds(candidate),
      foundationCatalogue
    );
    const validationDraft: RhythmDraft = {
      ...candidate,
      categoryIds: associations.categoryIds as CategoryId[],
      primaryFoundationId: associations.foundationIds[0] ?? null,
      secondaryFoundationIds: associations.foundationIds.slice(1)
    };
    if (!isCategoryEnabled(categoryPreferences, 'health')) {
      delete validationDraft.healthLogCapability;
      delete validationDraft.healthRunTarget;
    }
    return validateRhythmDraft(
      validationDraft,
      foundationCatalogue,
      people.map(person => person.id),
      timeOptions
    );
  }

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

  function rotationDraftErrors(candidate: RhythmDraft): RhythmDraftErrors {
    if (candidate.healthLogCapability !== 'workout' || candidate.healthWorkoutMode !== 'rotation') return {};
    const ids = candidate.healthWorkoutRotationWorkoutIds ?? [];
    if (ids.length < 2 || new Set(ids).size !== ids.length) {
      return { healthWorkoutRotationWorkoutIds: 'Select at least two distinct saved workouts.' };
    }
    if (ids.some(id => !savedWorkouts.some(workout => workout.id === id))) {
      return { healthWorkoutRotationWorkoutIds: 'Remove unavailable workouts or save them again before continuing.' };
    }
    return {};
  }

  function toggleRotationWorkout(id: string) {
    const selected = draft.healthWorkoutRotationWorkoutIds ?? [];
    update('healthWorkoutRotationWorkoutIds', selected.includes(id)
      ? selected.filter(selectedId => selectedId !== id)
      : [...selected, id]);
  }

  function moveRotationWorkout(id: string, offset: -1 | 1) {
    const ids = [...(draft.healthWorkoutRotationWorkoutIds ?? [])];
    const index = ids.indexOf(id);
    const nextIndex = index + offset;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
    update('healthWorkoutRotationWorkoutIds', ids);
  }

  function updateFitnessActivity(value: 'workout' | 'cardio' | 'weight' | 'flexibility') {
    const nextDraft = updateRhythmDraftFitnessActivity(draft, value);
    if (value !== 'cardio') nextDraft.healthRunTarget = null;
    const nextErrors = validateDraftForAvailableCategories(nextDraft);
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
      : normalizeRhythmPersonIds(draft.personIds));
    setPickerFoundationSelection(foundationRhythmIds(draft));
    setActivePicker(kind);
  }

  function closePicker(apply: boolean) {
    if (!activePicker) return;
    restoreFocusToPickerOpenerRef.current = true;
    if (apply) {
      if (activePicker === 'categories') {
        const categoryIds = mergePickerSelection(
          draft.categoryIds,
          pickerSelection,
          id => availableCategoryIds.has(id as CategoryId)
        );
        const foundationIds = mergePickerSelection(
          foundationRhythmIds(draft),
          pickerFoundationSelection,
          id => {
            const ownerCategoryId = foundationCategoryId(id, allFoundations);
            return ownerCategoryId !== undefined && availableCategoryIds.has(ownerCategoryId);
          }
        );
        const categoryDraft = {
          ...draft,
          categoryIds: categoryIds as RhythmDraft['categoryIds'],
          primaryFoundationId: foundationIds[0] ?? null,
          secondaryFoundationIds: foundationIds.slice(1)
        };
        const nextDraft = !draft.categoryIds.includes('health')
          && categoryDraft.categoryIds.includes('health')
          && categoryDraft.healthLogCapability == null
          ? updateRhythmDraftFitnessActivity(categoryDraft, 'workout')
          : categoryDraft;
        const nextCategoryErrors = validateDraftForAvailableCategories(nextDraft);
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
        const personIds = normalizeRhythmPersonIds(pickerSelection as RhythmDraft['personIds']);
        setDraft(previous => {
          const attachingPeople = previous.personIds.length === 0 && personIds.length > 0;
          return {
            ...previous,
            personIds,
            ...(attachingPeople && !previous.alsoLogConnectionExplicit && !rhythm
              ? { alsoLogConnection: true }
              : {})
          };
        });
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
    setPickerSelection(current => {
      const selection = activePicker === 'people'
        ? normalizeRhythmPersonIds(current as PersonId[])
        : current;
      return selection.includes(id)
        ? selection.filter(selected => selected !== id)
        : [...selection, id];
    });
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
    setPickerSelection(current => {
      const selection = toggleBadgeGroup(current, ids);
      return activePicker === 'people'
        ? normalizeRhythmPersonIds(selection as PersonId[])
        : selection;
    });
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
      const nextErrors = validateDraftForAvailableCategories(draft);
      if (draft.healthLogCapability === 'workout'
        && draft.healthWorkoutMode === 'specific'
        && !savedWorkouts.some(workout => workout.id === draft.healthWorkoutId)) {
        nextErrors.healthWorkoutId = 'Select an available saved workout.';
      }
      Object.assign(nextErrors, rotationDraftErrors(draft));
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
  const selectedCategories = availableCategories
    .filter(area => draft.categoryIds.includes(area.id));
  const selectedPeople = people
    .filter(person => draft.personIds.includes(person.id));
  const knownPersonIds = new Set(people.map(person => person.id));
  const unavailablePersonIds = normalizeRhythmPersonIds(
    draft.personIds.filter(id => !knownPersonIds.has(id))
  );
  const pickerUnavailablePersonIds = normalizeRhythmPersonIds(
    pickerSelection.filter(id => !knownPersonIds.has(id))
  );
  const selectedFoundationIds = [
    ...(draft.primaryFoundationId ? [draft.primaryFoundationId] : []),
    ...(draft.secondaryFoundationIds ?? [])
  ];
  const allFoundations = foundationCatalogue;
  const validationAssociations = selectCategoryAssociationsForValidation(
    categoryPreferences,
    draft.categoryIds,
    selectedFoundationIds,
    allFoundations
  );
  const missingRequiredCategories = missingRequiredFoundationCategories(
    validationAssociations.categoryIds,
    validationAssociations.foundationIds,
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
  const selectedFoundationGroups = availableCategories.map(area => {
    const categoryFoundations = allFoundations.filter(foundation =>
      foundationCategoryId(foundation.id, allFoundations) === area.id
        && selectedFoundationIds.includes(foundation.id)
        && availableFoundationIds.has(foundation.id)
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
    && availableFoundationIds.has(foundation.id)
    && ((foundation.lifecycle === 'active' && foundation.capabilities.rhythms)
      || pickerFoundationSelection.includes(foundation.id))
  );
  const foundationChoiceLabel = (foundation: FoundationPreview) =>
    foundation.lifecycle === 'active' && foundation.capabilities.rhythms
      ? foundation.name
      : `${foundation.name} (inactive; retained)`;
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
  const categoryNavigation = {
    getSummary: (area: typeof areas[number]) => foundationChoicesForCategory(area.id)
      .filter(foundation => pickerFoundationSelection.includes(foundation.id))
      .map(foundationChoiceLabel),
    hasValidSelection: (area: typeof areas[number]) =>
      pickerSelection.includes(area.id)
      && foundationChoicesForCategory(area.id).some(foundation =>
        pickerFoundationSelection.includes(foundation.id)
        && foundation.lifecycle === 'active'
        && foundation.capabilities.rhythms
      ),
    getDetail: (area: typeof areas[number]) => {
      const term = foundationTerminologyForCategory(area.id);
      return {
        description: `Choose one or more ${term.plural.toLowerCase()} for ${area.label}.`,
        optionsLabel: `${area.label} ${term.plural}`,
        options: foundationChoicesForCategory(area.id).map(foundation => ({
          id: foundation.id,
          label: foundationChoiceLabel(foundation),
          content: renderFoundationBadge(foundation),
          selected: pickerFoundationSelection.includes(foundation.id)
        }))
      };
    }
  };
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
            unavailableIds={unavailablePersonIds}
            openerRef={peoplePickerOpenerRef}
            onChoose={() => openPicker('people')}
          />
          {draft.personIds.length > 0 && (
            <label className="rhythm-editor__association-checkbox">
              <input
                type="checkbox"
                checked={draft.alsoLogConnection ?? false}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  setDraft(previous => ({
                    ...previous,
                    alsoLogConnection: checked,
                    alsoLogConnectionExplicit: true
                  }));
                }}
              />
              <span>
                <strong>Also log a connection</strong>
                <small>When you Tend this Rhythm, record a connection with the people selected.</small>
              </span>
            </label>
          )}
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
                <span className={`rhythm-editor__association-category-list${rhythm ? ' rhythm-editor__association-category-list--labeled' : ''}`}>
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
                        aria-label={`${category.label} category${group
                          ? ` and linked ${foundationTerminologyForCategory(category.id).plural}`
                          : ''}`}
                      >
                        <RhythmCategoryBadges
                          rhythm={categoryRhythm}
                          itemsOnly
                          presentation={rhythm ? 'edit-labeled' : 'static'}
                        />
                        {group && (
                          <RhythmFoundationBadges
                            rhythm={group.rhythm}
                            foundations={allFoundations}
                            presentation={rhythm ? 'edit-labeled' : 'static'}
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
                  matchTriggerWidth
                  options={[
                    { value: 'workout', label: 'Workout' },
                    { value: 'cardio', label: 'Cardio' },
                    { value: 'weight', label: 'Weigh-in' },
                    { value: 'flexibility', label: 'Stretch routine' }
                  ]}
                  onChange={value => {
                    if (value !== 'workout' && value !== 'cardio' && value !== 'weight'
                      && value !== 'flexibility') return;
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
                        { value: 'custom', label: 'Custom workout' },
                        { value: 'rotation', label: 'Workout rotation' }
                      ]}
                      onChange={value => {
                        if (value === 'recommended' || value === 'specific' || value === 'custom'
                          || value === 'rotation') {
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
                  {draft.healthWorkoutMode === 'rotation' && (
                    <div className="rhythm-editor__rotation-setup">
                      <fieldset className="rhythm-editor__rotation-workouts">
                        <legend>Select workouts</legend>
                        <CheckboxTileOptions
                          options={[
                            ...savedWorkouts.map(workout => ({ id: workout.id, label: workout.name })),
                            ...(draft.healthWorkoutRotationWorkoutIds ?? [])
                              .filter(id => !savedWorkouts.some(workout => workout.id === id))
                              .map(id => ({
                                id,
                                label: `${savedRotationVersion?.workoutNames[
                                  savedRotationVersion.workoutIds.indexOf(id)
                                ] ?? 'Saved workout'} (unavailable)`
                              }))
                          ]}
                          selectedIds={draft.healthWorkoutRotationWorkoutIds ?? []}
                          onToggle={toggleRotationWorkout}
                        />
                        {fieldError('healthWorkoutRotationWorkoutIds')}
                      </fieldset>
                      <div className="goal-field">
                        <span className="rhythm-editor__rotation-order-label">Rotation order</span>
                        {(draft.healthWorkoutRotationWorkoutIds ?? []).length === 0
                          ? <p className="rhythm-editor__rotation-empty">Select at least two saved workouts.</p>
                          : <ol className="rhythm-editor__rotation-order">
                            {(draft.healthWorkoutRotationWorkoutIds ?? []).map((id, index, ids) => {
                              const workout = savedWorkouts.find(item => item.id === id);
                              const savedName = healthWorkoutSetting?.rotationHistory?.at(-1)?.workoutIds
                                .indexOf(id) ?? -1;
                              const name = workout?.name
                                ?? savedRotationVersion?.workoutNames[savedName]
                                ?? 'Unavailable saved workout';
                              return (
                                <li key={id} className={!workout ? 'is-unavailable' : undefined}>
                                  <span>{name}{workout ? '' : ' (unavailable)'}</span>
                                  <span className="rhythm-editor__rotation-order-actions">
                                    <button
                                      className="btn mini"
                                      type="button"
                                      aria-label={`Move ${name} up`}
                                      disabled={index === 0}
                                      onClick={() => moveRotationWorkout(id, -1)}
                                    >Move up</button>
                                    <button
                                      className="btn mini"
                                      type="button"
                                      aria-label={`Move ${name} down`}
                                      disabled={index === ids.length - 1}
                                      onClick={() => moveRotationWorkout(id, 1)}
                                    >Move down</button>
                                  </span>
                                </li>
                              );
                            })}
                          </ol>}
                      </div>
                      <p className="rhythm-editor__rotation-help">
                        Each time this Rhythm is due, use the next workout in your rotation.
                      </p>
                      <div className="goal-field">
                        <label>Advance rotation</label>
                        <StyledSelect
                          label="Advance rotation"
                          value={draft.healthWorkoutRotationAdvanceMode ?? 'after-completion'}
                          options={[
                            { value: 'after-completion', label: 'After completion' },
                            { value: 'each-scheduled-occurrence', label: 'Each scheduled occurrence' }
                          ]}
                          onChange={value => {
                            if (value === 'after-completion' || value === 'each-scheduled-occurrence') {
                              update('healthWorkoutRotationAdvanceMode', value);
                            }
                          }}
                        />
                        <p className="goal-field-hint">
                          {draft.healthWorkoutRotationAdvanceMode === 'each-scheduled-occurrence'
                            ? 'Move to the next workout whenever this Rhythm is due, even if the previous one was missed.'
                            : 'Repeat the same workout until you complete it.'}
                        </p>
                      </div>
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
        title={draft.title.trim() || 'New Rhythm'}
        titleId="rhythm-association-context-title"
        labelledBy={activePicker === 'categories' && pendingCategoryRemoval
          ? 'rhythm-category-removal-title'
          : 'rhythm-association-picker-title'}
        initialFocusId={categoryPickerFocusId ?? (
          pendingCategoryRemoval ? 'rhythm-category-removal-confirm' : 'rhythm-association-picker-title'
        )}
        stopEscapePropagation
        portalToBody
        phoneFullScreen
        dialogClassName={`money-goal-dialog--association-picker${activePicker === 'categories' ? ' money-goal-dialog--category-picker' : ' money-goal-dialog--people-picker'}`}
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
            description="Where does this Rhythm belong?"
            items={availableCategories}
            selectedIds={pickerSelection}
            getLabel={area => area.label}
            renderBadge={renderCategoryBadge}
            navigation={categoryNavigation}
            unavailableSelectedItems={pickerFoundationLinksNeedingReview}
            unavailableGroupLabel="Existing Foundation links needing review"
            getUnavailableItemLabel={item => `Remove existing Foundation link ${item.label}`}
            unavailableItemType="Foundation"
            doneLabel="Done"
            focusItemId={categoryPickerFocusId}
            onToggle={togglePickerItem}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        ) : activePicker === 'people' ? (
          <PeopleBadgeSelectionPicker
            people={people}
            selectedIds={normalizeRhythmPersonIds(pickerSelection as PersonId[])}
            unavailableSelectedIds={pickerUnavailablePersonIds}
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
