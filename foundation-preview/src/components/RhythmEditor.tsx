import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import {
  areas,
  foundationCatalogue,
  foundationTerminologyForCategory,
  syntheticPeople,
  syntheticPersonPickerGroups
} from '../domain/preview-data.ts';
import type { FoundationPreview, PersonId, PersonPickerGroup } from '../domain/preview-data.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import {
  foundationCategoryId,
  removeFoundationLinksForCategory
} from '../domain/foundation-rhythm-associations.ts';
import { foundationRhythmIds } from '../domain/foundation-rhythm-associations.ts';
import { rhythmDraftFrom, validateRhythmDraft } from '../domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors } from '../domain/rhythm-editor.ts';
import { rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
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

type RhythmEditorProps = {
  rhythm?: RhythmPreview;
  initialDraft?: RhythmDraft;
  suggestionSourceId?: string;
  recommendedFrequency?: RhythmFrequencyRecommendation;
  frequencyGuidance?: string;
  asOfDate?: string;
  peopleGroups?: readonly PersonPickerGroup[];
  hasDatedCompletionHistory?: boolean;
  onSave: (draft: RhythmDraft) => RhythmDraftErrors;
  onArchive?: (id: string) => void;
  onClose: () => void;
};

type AssociationKind = 'categories' | 'people' | 'foundations';
type ScheduleDraftSnapshot = Pick<RhythmDraft, 'schedule' | 'scheduleEditing' | 'seasonName'>;

function accessibleScheduleDescription(schedule: NonNullable<RhythmDraft['schedule']>) {
  return formatRhythmSchedule(schedule, 'detailed').replace(/\.+$/, '');
}

function RhythmAssociationRow({
  title,
  accessibleName,
  openerRef,
  onChoose,
  children
}: {
  title: string;
  accessibleName: string;
  openerRef: RefObject<HTMLButtonElement | null>;
  onChoose: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={openerRef}
      type="button"
      className="rhythm-editor__association-row"
      aria-label={accessibleName}
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
  peopleGroups = syntheticPersonPickerGroups,
  hasDatedCompletionHistory = false,
  onSave,
  onArchive,
  onClose
}: RhythmEditorProps) {
  const [draft, setDraft] = useState<RhythmDraft>(() => initialDraft
    ? {
        ...initialDraft,
        personIds: [...initialDraft.personIds],
        categoryIds: [...initialDraft.categoryIds],
        ...(initialDraft.secondaryFoundationIds === undefined
          ? {}
          : { secondaryFoundationIds: [...initialDraft.secondaryFoundationIds] })
      }
    : rhythm
      ? rhythmDraftFrom(rhythm, rhythm.categoryIds ?? [], asOfDate)
      : emptyDraft());
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
  const foundationPickerOpenerRef = useRef<HTMLButtonElement>(null);
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
      const dialog = document.querySelector<HTMLDialogElement>('.money-goal-dialog');
      if (dialog) dialog.scrollTop = pickerScrollTopRef.current;
      ({
        categories: categoryPickerOpenerRef.current,
        people: peoplePickerOpenerRef.current,
        foundations: foundationPickerOpenerRef.current
      })[pickerOriginRef.current]?.focus({ preventScroll: true });
      restoreFocusToPickerOpenerRef.current = false;
    }
  }, [activePicker]);

  useEffect(() => {
    if (showArchiveConfirmation) archiveConfirmButtonRef.current?.focus();
    else if (wasConfirmingArchiveRef.current) archiveButtonRef.current?.focus();
    wasConfirmingArchiveRef.current = showArchiveConfirmation;
  }, [showArchiveConfirmation]);

  useEffect(() => {
    if (pendingCategoryRemoval) categoryRemovalButtonRef.current?.focus();
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

  function openPicker(kind: AssociationKind) {
    const dialog = document.querySelector<HTMLDialogElement>('.money-goal-dialog');
    pickerScrollTopRef.current = dialog?.scrollTop ?? 0;
    pickerOriginRef.current = kind;
    setCategoryPickerFocusId(null);
    setPendingCategoryRemoval(null);
    setPickerSelection(kind === 'categories'
      ? [...draft.categoryIds]
      : kind === 'people'
        ? [...draft.personIds]
        : [
            ...(draft.primaryFoundationId ? [draft.primaryFoundationId] : []),
            ...(draft.secondaryFoundationIds ?? [])
          ]);
    setPickerFoundationSelection(foundationRhythmIds(draft));
    setActivePicker(kind);
  }

  function closePicker(apply: boolean) {
    if (!activePicker) return;
    restoreFocusToPickerOpenerRef.current = true;
    if (apply) {
      if (activePicker === 'categories') {
        setDraft(previous => ({
          ...previous,
          categoryIds: pickerSelection as RhythmDraft['categoryIds'],
          primaryFoundationId: pickerFoundationSelection[0] ?? null,
          secondaryFoundationIds: pickerFoundationSelection.slice(1)
        }));
        setErrors(previous => {
          const next = { ...previous };
          delete next.categoryIds;
          delete next.foundationIds;
          return next;
        });
      } else if (activePicker === 'people') {
        update('personIds', pickerSelection as RhythmDraft['personIds']);
      } else {
        setDraft(previous => ({
          ...previous,
          primaryFoundationId: pickerSelection[0] ?? null,
          secondaryFoundationIds: pickerSelection.slice(1)
        }));
        setErrors(previous => {
          const next = { ...previous };
          delete next.foundationIds;
          return next;
        });
      }
    }
    setPendingCategoryRemoval(null);
    setActivePicker(null);
  }

  function togglePickerItem(id: string) {
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
      const nextErrors = validateRhythmDraft(draft);
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

  const timeValue = rhythmTimeOptions.find(option => option.label === draft.timeLabel)?.value ?? '';
  const effectiveSchedule = draft.originalSchedule ?? draft.schedule;
  const hasProtectedScheduleHistory = Boolean(rhythm && (hasDatedCompletionHistory || hasPreservedSeasonHistory));
  const showCadenceDescription = Boolean(
    rhythm && hasProtectedScheduleHistory && draft.originalSchedule && !isChangingSchedule
  );
  useLayoutEffect(() => {
    if (restoreProtectedFrequencyFocusRef.current) {
      const dialog = document.querySelector<HTMLDialogElement>('.money-goal-dialog--rhythm-editor');
      if (dialog) dialog.scrollTop = scheduleDialogScrollTopRef.current;
      const returnFocusTarget = protectedFrequencyButtonRef.current
        ?? dialog?.querySelector<HTMLButtonElement>('.rhythm-schedule-fields__frequency .rhythm-select__trigger');
      returnFocusTarget?.focus({ preventScroll: true });
      restoreProtectedFrequencyFocusRef.current = false;
    }
    if (!showCadenceDescription && focusScheduleControlRef.current) {
      const dialog = document.querySelector<HTMLDialogElement>('.money-goal-dialog--rhythm-editor');
      const scheduleControl = dialog?.querySelector<HTMLButtonElement>(
        '.rhythm-schedule-fields .rhythm-select__trigger'
      );
      if (dialog && scheduleControl) {
        dialog.scrollTop = scheduleDialogScrollTopRef.current;
        scheduleControl.focus({ preventScroll: true });
        const dialogBounds = dialog.getBoundingClientRect();
        const controlBounds = scheduleControl.getBoundingClientRect();
        if (controlBounds.top < dialogBounds.top) {
          dialog.scrollTop -= dialogBounds.top - controlBounds.top;
        } else if (controlBounds.bottom > dialogBounds.bottom) {
          dialog.scrollTop += controlBounds.bottom - dialogBounds.bottom;
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
    ? rhythmTimeLabel(originalSeason.timeOfDay)
    : rhythm?.timeLabel ?? 'Anytime';
  const showScheduleTimeComparison = originalTimeLabel !== draft.timeLabel;
  const scheduleEffectiveDate = asOfDate ?? localDateString(new Date());
  const selectedCategories = areas
    .filter(area => draft.categoryIds.includes(area.id));
  const selectedPeople = syntheticPeople
    .filter(person => draft.personIds.includes(person.id));
  const selectedFoundationIds = [
    ...(draft.primaryFoundationId ? [draft.primaryFoundationId] : []),
    ...(draft.secondaryFoundationIds ?? [])
  ];
  const allFoundations = foundationCatalogue;
  const foundationTerms = [...new Set(
    selectedCategories.flatMap(category =>
      allFoundations.some(foundation => foundation.categoryId === category.id)
        ? [foundationTerminologyForCategory(category.id).plural]
        : []
    )
  )];
  const foundationPickerTitle = foundationTerms.length > 1
    ? 'Choose Foundations and Practices'
    : foundationTerms[0] === 'Practices'
      ? 'Choose Practices'
      : 'Choose Foundations';
  const foundationRowTitle = foundationTerms.length > 1
    ? 'Practices and Foundations'
    : foundationTerms[0] === 'Practices'
      ? 'Practices'
      : 'Foundations';
  const primaryFoundationTerm = foundationTerms.length === 1 && foundationTerms[0] === 'Practices'
    ? foundationTerminologyForCategory('faith')
    : foundationTerminologyForCategory();
  const foundationLinkTerm = foundationTerms.length > 1
    ? 'Practice and Foundation'
    : primaryFoundationTerm.singular;
  const eligibleFoundations = allFoundations.filter(foundation => {
    const ownerCategoryId = foundationCategoryId(foundation.id, allFoundations);
    return ownerCategoryId !== undefined
      && foundation.lifecycle === 'active'
      && foundation.capabilities.rhythms
      && draft.categoryIds.includes(ownerCategoryId);
  });
  const ineligibleSelectedFoundations = allFoundations.filter(foundation =>
    selectedFoundationIds.includes(foundation.id)
      && !eligibleFoundations.some(eligible => eligible.id === foundation.id)
  );
  const foundationPickerItems = [
    ...eligibleFoundations,
    ...ineligibleSelectedFoundations
  ];
  const unavailableSelectedFoundationItems = selectedFoundationIds
    .filter(id => !allFoundations.some(foundation => foundation.id === id))
    .map(id => ({
      id,
      label: `Unresolved ${primaryFoundationTerm.singular} reference: ${id}`
    }));
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
  const categoriesWithoutFoundationDefinitions = selectedCategories.filter(category =>
    !allFoundations.some(foundation =>
      foundationCategoryId(foundation.id, allFoundations) === category.id
        && foundation.capabilities.rhythms
        && foundation.lifecycle === 'active'
    )
  );
  const associationName = (title: string, selected: readonly string[], emptyState: string) => {
    const prefix = `Choose ${title.toLowerCase()}`;
    if (selected.length === 0) return emptyState;
    const selectedNames = selected.length === 1
      ? selected[0]!
      : `${selected.slice(0, -1).join(', ')} and ${selected.at(-1)}`;
    return `${prefix}, ${selectedNames}`;
  };
  const foundationEmptyState = selectedCategories.length === 0
    ? 'Choose a category first'
    : eligibleFoundations.length === 0
      ? categoriesWithoutFoundationDefinitions.length > 0
        ? `No ${foundationTerms[0] ?? 'Foundations'} are defined for ${categoriesWithoutFoundationDefinitions.map(category => category.label).join(', ')}`
        : `No ${foundationTerms[0] ?? 'Foundations'} are available for the selected categories`
      : foundationTerms.length === 1 && foundationTerms[0] === 'Practices'
        ? 'Choose Practices'
        : 'Choose foundations';
  const selectedFoundationNames = [
    ...selectedFoundationGroups.flatMap(group =>
      group.foundations.map(foundation => `${group.area.label}: ${foundation.name}`)
    ),
    ...unavailableSelectedFoundationItems.map(item => `Unresolved: ${item.id}`)
  ];
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
        options={rhythmTimeOptions}
        value={timeValue}
        describedBy={errors.timeLabel ? 'rhythm-error-timeLabel' : undefined}
        invalid={Boolean(errors.timeLabel)}
        onChange={value => {
          const option = rhythmTimeOptions.find(item => item.value === value);
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
    const dialog = document.querySelector<HTMLDialogElement>('.money-goal-dialog--rhythm-editor');
    scheduleDialogScrollTopRef.current = dialog?.scrollTop ?? 0;
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
      dialogClassName="money-goal-dialog--rhythm-editor"
      intro={suggestionSourceId
        ? 'Suggested Rhythm draft. Nothing is saved until you choose Add Rhythm. Choose the schedule that fits; the catalogue hint is only a recommendation.'
        : 'Synthetic preview only. Schedules are stored and displayed, but do not calculate due dates or control completion eligibility.'}
      onClose={handleDialogEscape}
    >
      <form className="rhythm-editor" onSubmit={submit} noValidate>
        <div className="goal-field rhythm-editor__title-field">
          <label htmlFor="rhythm-title">Title</label>
          <input
            id="rhythm-title"
            autoFocus
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
        {rhythm && draft.originalSchedule === undefined && (
          <button
            type="button"
            className="rhythm-editor__keep-descriptive"
            onClick={() => {
              update('scheduleEditing', false);
              update('schedule', undefined);
            }}
          >
            Keep descriptive cadence
          </button>
        )}

        <section className="rhythm-editor__association" aria-label="Associations">
          <PeopleAssociationRow
            selectedPeople={selectedPeople}
            openerRef={peoplePickerOpenerRef}
            onChoose={() => openPicker('people')}
          />
          <RhythmAssociationRow
            title="Categories"
            accessibleName={associationName('categories', selectedCategories.map(category => category.label), 'Choose categories')}
            openerRef={categoryPickerOpenerRef}
            onChoose={() => openPicker('categories')}
          >
            {selectedCategories.length > 0 ? (
              <span className="rhythm-editor__association-categories">
                <RhythmCategoryBadges rhythm={associationRhythm} itemsOnly presentation="static" />
              </span>
            ) : <span className="rhythm-editor__association-empty">Choose categories</span>}
          </RhythmAssociationRow>
          {(draft.categoryIds.includes('health') || draft.healthLogCapability !== undefined) && (
            <div className="rhythm-editor__fitness-capabilities" aria-label="Health & Fitness logging">
              <label className="rhythm-editor__fitness-capability">
                <input type="checkbox" checked={draft.healthLogCapability === 'cardio'}
                  onChange={event => update('healthLogCapability', event.currentTarget.checked ? 'cardio' : undefined)} />
                <span>Can log a run</span>
              </label>
              <label className="rhythm-editor__fitness-capability">
                <input type="checkbox" checked={draft.healthLogCapability === 'weight'}
                  onChange={event => update('healthLogCapability', event.currentTarget.checked ? 'weight' : undefined)} />
                <span>Can log a weigh-in</span>
              </label>
            </div>
          )}
          <RhythmAssociationRow
            title={foundationRowTitle}
            accessibleName={associationName(foundationRowTitle, selectedFoundationNames, foundationEmptyState)}
            openerRef={foundationPickerOpenerRef}
            onChoose={() => openPicker('foundations')}
          >
            {selectedFoundationIds.length > 0 ? (
              <span className="rhythm-editor__association-foundations">
                {selectedFoundationGroups.map(group => (
                  <span key={group.area.id} className="rhythm-editor__association-foundation-group">
                    <span className="rhythm-editor__association-foundation-category">
                      {group.area.label} {foundationTerminologyForCategory(group.area.id).plural.toLowerCase()}
                    </span>
                    <RhythmFoundationBadges
                      rhythm={group.rhythm}
                      foundations={allFoundations}
                      presentation="static"
                    />
                  </span>
                ))}
                {unavailableSelectedFoundationItems.map(item => (
                  <span
                    key={item.id}
                    className="rhythm-editor__association-unresolved"
                    role="img"
                    aria-label={`Unresolved ${primaryFoundationTerm.singular} reference: ${item.id}`}
                    title={`Unresolved ${primaryFoundationTerm.singular} reference: ${item.id}`}
                  >
                    Unresolved: {item.id}
                  </span>
                ))}
              </span>
            ) : <span className="rhythm-editor__association-empty">{foundationEmptyState}</span>}
            {categoriesWithoutFoundationDefinitions.length > 0
              && (eligibleFoundations.length > 0 || selectedFoundationIds.length > 0) && (
              <span className="rhythm-editor__association-unavailable">
                {categoriesWithoutFoundationDefinitions.map(category =>
                  `No ${foundationTerminologyForCategory(category.id).plural} are defined for ${category.label}`
                ).join('. ')}.
              </span>
            )}
          </RhythmAssociationRow>
        </section>
        <div className="rhythm-editor__association-errors">
          {fieldError('personIds')}
          {fieldError('categoryIds')}
          {invalidFoundationLinks.some(id => allFoundations.some(foundation => foundation.id === id)) && (
            <p className="goal-field-error" role="status">
            Some {foundationLinkTerm} links need their Category selected or must be explicitly removed.
            </p>
          )}
          {fieldError('foundationIds')}
        </div>

        {Object.keys(errors).length > 0 && (
          <p className="goal-form-error-summary" role="alert">Review the highlighted Rhythm fields.</p>
        )}
        <div className="rhythm-editor__action-row">
          <div className="money-goal-dialog__actions rhythm-editor__primary-actions">
            <button ref={saveButtonRef} type="submit" className="btn mini">{rhythm ? 'Save Rhythm' : 'Add Rhythm'}</button>
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
        labelledBy={activePicker === 'categories' && pendingCategoryRemoval
          ? 'rhythm-category-removal-title'
          : 'rhythm-association-picker-title'}
        initialFocusId={categoryPickerFocusId ?? (
          pendingCategoryRemoval ? 'rhythm-category-removal-confirm' : 'rhythm-association-picker-title'
        )}
        stopEscapePropagation
        portalToBody
        dialogClassName="money-goal-dialog--association-picker"
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
            items={areas}
            selectedIds={pickerSelection}
            getLabel={area => area.label}
            renderBadge={renderCategoryBadge}
            focusItemId={categoryPickerFocusId}
            onToggle={togglePickerItem}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        ) : activePicker === 'people' ? (
          <PeopleBadgeSelectionPicker
            selectedIds={pickerSelection.filter((id): id is PersonId =>
              syntheticPeople.some(person => person.id === id)
            )}
            onToggle={id => togglePickerItem(id)}
            onToggleGroup={selectPickerGroup}
            groups={peopleGroups}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        ) : (
          <BadgeSelectionPicker
            title={foundationPickerTitle}
            items={foundationPickerItems}
            selectedIds={pickerSelection}
            getLabel={foundation => eligibleFoundations.some(item => item.id === foundation.id)
              ? foundation.name
              : `${foundation.name} (currently linked; ${foundation.category} category not selected)`}
            renderBadge={renderFoundationBadge}
            emptyMessage={foundationEmptyState}
            groupBy={foundation => foundation.categoryId === 'faith'
              ? `${foundation.category} ${foundationTerminologyForCategory(foundation.categoryId).plural}`
              : foundation.category}
            unavailableSelectedItems={unavailableSelectedFoundationItems}
            unavailableItemType={primaryFoundationTerm.singular}
            onToggle={togglePickerItem}
            onDone={() => closePicker(true)}
            onCancel={() => closePicker(false)}
          />
        )}
      </MoneyGoalDialog>
    )}
    </>
  );
}
