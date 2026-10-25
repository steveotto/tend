import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { areas, syntheticPeople, syntheticPersonPickerGroups } from '../domain/preview-data.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import type { RhythmPreview } from '../domain/preview-data.ts';
import { rhythmDraftFrom, validateRhythmDraft } from '../domain/rhythm-editor.ts';
import type { RhythmDraft, RhythmDraftErrors } from '../domain/rhythm-editor.ts';
import { rhythmTimeOptions } from '../domain/rhythm-schedule.ts';
import { formatRhythmSchedule } from '../domain/rhythm-schedule.ts';
import { rhythmSchedulesEqual } from '../domain/rhythm-occurrences.ts';
import { RhythmScheduleFields } from './RhythmScheduleFields.tsx';
import { StyledSelect } from './StyledSelect.tsx';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';
import { BadgeSelectionPicker, toggleBadgeGroup } from './BadgeSelectionPicker.tsx';
import { AreaIcon } from './AreaIcon.tsx';
import { PersonBadgeVisual } from './PersonBadge.tsx';

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
  hasDatedCompletionHistory?: boolean;
  onSave: (draft: RhythmDraft) => RhythmDraftErrors;
  onArchive?: (id: string) => void;
  onClose: () => void;
};

export function RhythmEditor({
  rhythm,
  hasDatedCompletionHistory = false,
  onSave,
  onArchive,
  onClose
}: RhythmEditorProps) {
  const [draft, setDraft] = useState<RhythmDraft>(() =>
    rhythm
      ? rhythmDraftFrom(rhythm, rhythm.categoryIds ?? [])
      : emptyDraft()
  );
  const [errors, setErrors] = useState<RhythmDraftErrors>({});
  const [showArchiveConfirmation, setShowArchiveConfirmation] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] = useState(false);
  const [isChangingSchedule, setIsChangingSchedule] = useState(false);
  const [activePicker, setActivePicker] = useState<'categories' | 'people' | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const categoryPickerOpenerRef = useRef<HTMLButtonElement>(null);
  const peoplePickerOpenerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusToPickerOpenerRef = useRef(false);
  const pickerOriginRef = useRef<'categories' | 'people'>('categories');
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const archiveConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingArchiveRef = useRef(false);
  const savedCurrentSeason = rhythm?.scoring?.scheduleHistory.at(-1);
  const hasPreservedSeasonHistory = (rhythm?.scoring?.scheduleHistory.length ?? 0) > 1;

  useEffect(() => {
    if (activePicker === null && restoreFocusToPickerOpenerRef.current) {
      (pickerOriginRef.current === 'categories'
        ? categoryPickerOpenerRef.current
        : peoplePickerOpenerRef.current)?.focus();
      restoreFocusToPickerOpenerRef.current = false;
    }
  }, [activePicker]);

  useEffect(() => {
    if (showArchiveConfirmation) archiveConfirmButtonRef.current?.focus();
    else if (wasConfirmingArchiveRef.current) archiveButtonRef.current?.focus();
    wasConfirmingArchiveRef.current = showArchiveConfirmation;
  }, [showArchiveConfirmation]);

  function update<K extends keyof RhythmDraft>(field: K, value: RhythmDraft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => {
      const next = { ...previous };
      delete next[field];
      if (field === 'schedule') delete next.schedule;
      return next;
    });
  }

  function openPicker(kind: 'categories' | 'people') {
    pickerOriginRef.current = kind;
    setPickerSelection([...(kind === 'categories' ? draft.categoryIds : draft.personIds)]);
    setActivePicker(kind);
  }

  function closePicker(apply: boolean) {
    if (!activePicker) return;
    restoreFocusToPickerOpenerRef.current = true;
    if (apply) {
      if (activePicker === 'categories') {
        update('categoryIds', pickerSelection as RhythmDraft['categoryIds']);
      } else {
        update('personIds', pickerSelection as RhythmDraft['personIds']);
      }
    }
    setActivePicker(null);
  }

  function togglePickerItem(id: string) {
    setPickerSelection(current => current.includes(id)
      ? current.filter(selected => selected !== id)
      : [...current, id]);
  }

  function selectPickerGroup(ids: readonly string[]) {
    setPickerSelection(current => toggleBadgeGroup(current, ids));
  }

  function handleDialogEscape() {
    if (activePicker) closePicker(false);
    else onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const originalSchedule = draft.originalSchedule ?? rhythm?.schedule;
    const scheduleChanged = draft.schedule !== undefined && originalSchedule !== undefined
      ? !rhythmSchedulesEqual(draft.schedule, originalSchedule)
      : draft.schedule !== originalSchedule;
    if (rhythm && (hasDatedCompletionHistory || hasPreservedSeasonHistory)
      && scheduleChanged && draft.schedule) {
      const nextErrors = validateRhythmDraft(draft);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) setShowScheduleConfirmation(true);
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
    setDraft(({ schedule: _schedule, seasonName: _seasonName, ...current }) => ({
      ...current,
      ...(rhythm?.schedule ? { schedule: rhythm.schedule } : {}),
      scheduleEditing: false,
      ...(savedCurrentSeason?.kind === 'scheduled' && savedCurrentSeason.name
        ? { seasonName: savedCurrentSeason.name }
        : {})
    }));
    setErrors(current => {
      const next = { ...current };
      delete next.schedule;
      delete next.seasonName;
      return next;
    });
    saveButtonRef.current?.focus();
  }

  function fieldError(field: keyof RhythmDraft) {
    return errors[field]
      ? <span className="goal-field-error" id={`rhythm-error-${field}`}>{errors[field]}</span>
      : null;
  }

  const timeValue = rhythmTimeOptions.find(option => option.label === draft.timeLabel)?.value ?? '';
  const hasSchedule = draft.scheduleEditing === true;
  const showCadenceDescription = !hasSchedule
    || Boolean(rhythm && (hasDatedCompletionHistory || hasPreservedSeasonHistory) && !isChangingSchedule);
  const originalSchedule = draft.originalSchedule ?? rhythm?.schedule;
  const currentScheduleLabel = rhythm?.schedule
    ? formatRhythmSchedule(rhythm.schedule, 'detailed')
    : draft.cadence;
  const originalScheduleLabel = originalSchedule
    ? formatRhythmSchedule(originalSchedule, 'detailed')
    : rhythm?.cadence ?? 'Previous schedule unavailable';
  const selectedCategories = areas
    .filter(area => draft.categoryIds.includes(area.id));
  const selectedPeople = syntheticPeople
    .filter(person => draft.personIds.includes(person.id));
  const renderCategoryBadge = (area: typeof areas[number]) => (
    <>
      <span className="rhythm-association-picker__category-icon" aria-hidden="true"><AreaIcon id={area.id} /></span>
      <span>{area.label}</span>
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

  return (
    <MoneyGoalDialog
      title={rhythm ? 'Edit Rhythm' : 'Add Rhythm'}
      intro="Synthetic preview only. Schedules are stored and displayed, but do not calculate due dates or control completion eligibility."
      onClose={handleDialogEscape}
    >
      {activePicker === 'categories' ? (
        <BadgeSelectionPicker
          title="Choose categories"
          items={areas}
          selectedIds={pickerSelection}
          getLabel={area => area.label}
          renderBadge={renderCategoryBadge}
          onToggle={togglePickerItem}
          onDone={() => closePicker(true)}
          onCancel={() => closePicker(false)}
        />
      ) : activePicker === 'people' ? (
        <BadgeSelectionPicker
          title="Choose people"
          items={syntheticPeople}
          selectedIds={pickerSelection}
          getLabel={person => person.displayName}
          renderBadge={(person: PersonPreview) => <PersonBadgeVisual person={person} />}
          groups={syntheticPersonPickerGroups}
          onToggle={togglePickerItem}
          onToggleGroup={selectPickerGroup}
          onDone={() => closePicker(true)}
          onCancel={() => closePicker(false)}
        />
      ) : (
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

        <label className="rhythm-editor-choice rhythm-editor__personal">
          <input
            type="checkbox"
            checked={draft.personal ?? false}
            onChange={event => update('personal', event.currentTarget.checked)}
          />
          <span>Personal</span>
        </label>

        {showCadenceDescription ? (
          <>
            <section className="rhythm-editor__descriptive-schedule" aria-labelledby="rhythm-current-cadence">
              <div>
                <h3 id="rhythm-current-cadence">Current cadence</h3>
                <p>{currentScheduleLabel}</p>
              </div>
              <button
                type="button"
                className="rhythm-editor__change-schedule"
                onClick={() => {
                  setIsChangingSchedule(true);
                  update('scheduleEditing', true);
                }}
              >
                Change schedule
              </button>
            </section>
            {timeOfDayField}
          </>
        ) : (
          <>
            <RhythmScheduleFields
              schedule={draft.schedule}
              error={errors.schedule}
              onChange={schedule => update('schedule', schedule)}
            >
              {timeOfDayField}
            </RhythmScheduleFields>
            {rhythm && rhythm.schedule === undefined && (
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
          </>
        )}

        <section className="rhythm-editor__association" aria-label="Associations">
          <div className="rhythm-editor__association-row" role="group" aria-label="Category associations">
            <button
              ref={categoryPickerOpenerRef}
              type="button"
              className="rhythm-editor__association-opener"
              aria-label="Add categories"
              onClick={() => openPicker('categories')}
            >
              <span>Add categories</span>
            </button>
            {selectedCategories.map(area => (
              <span key={area.id} className="rhythm-editor__selected-badge" role="img" aria-label={area.label}>
                {renderCategoryBadge(area)}
              </span>
            ))}
            {fieldError('categoryIds')}
          </div>
          <div className="rhythm-editor__association-row" role="group" aria-label="People associations">
            <button
              ref={peoplePickerOpenerRef}
              type="button"
              className="rhythm-editor__association-opener"
              aria-label="Add people"
              onClick={() => openPicker('people')}
            >
              <span>Add people</span>
            </button>
            {selectedPeople.map(person => (
              <span key={person.id} className="rhythm-editor__selected-badge" role="img" aria-label={person.displayName}>
                <PersonBadgeVisual person={person} />
              </span>
            ))}
            {fieldError('personIds')}
          </div>
        </section>

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
      {showScheduleConfirmation && rhythm && draft.schedule && (
        <MoneyGoalDialog
          labelledBy="rhythm-schedule-confirmation-title"
          initialFocusId="rhythm-season-label"
          closeLabel="Cancel schedule change"
          onClose={cancelScheduleChange}
        >
          <section
            className="rhythm-editor__schedule-confirmation"
            aria-labelledby="rhythm-schedule-confirmation-title"
          >
            <h2 id="rhythm-schedule-confirmation-title">Change your schedule</h2>
            <p className="rhythm-editor__schedule-transition">
              <span>{originalScheduleLabel}</span>
              <span aria-hidden="true"> → </span>
              <span>{formatRhythmSchedule(draft.schedule, 'detailed')}</span>
            </p>
            <p><strong>Starting today</strong></p>
            <p>Earlier logs keep their previous schedule.</p>
            <div className="goal-field">
              <label htmlFor="rhythm-season-label">Season label (optional)</label>
              <input
                id="rhythm-season-label"
                maxLength={80}
                value={draft.seasonName ?? ''}
                onChange={event => update('seasonName', event.currentTarget.value)}
              />
            </div>
            <div className="money-goal-dialog__actions">
              <button type="button" className="btn mini" onClick={confirmScheduleChange}>Confirm change</button>
              <button type="button" className="btn mini ghost" onClick={cancelScheduleChange}>Cancel</button>
            </div>
          </section>
        </MoneyGoalDialog>
      )}
    </MoneyGoalDialog>
  );
}
