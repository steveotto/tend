import { useState } from 'react';
import type { MouseEvent } from 'react';
import { strengthMuscleName, strengthWorkoutSuggestions } from '../domain/strength.ts';
import type { StrengthSavedWorkout, StrengthWorkoutSuggestion } from '../domain/strength.ts';
import { MoneyGoalDialog } from './MoneyGoalDialog.tsx';

type StrengthWorkoutSuggestionsDialogProps = {
  savedWorkouts: readonly StrengthSavedWorkout[];
  focusSourceId?: string;
  onAdd: (suggestion: StrengthWorkoutSuggestion, event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (
    suggestion: StrengthWorkoutSuggestion,
    workout: StrengthSavedWorkout,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  onClose: () => void;
};

export function StrengthWorkoutSuggestionsDialog({
  savedWorkouts,
  focusSourceId,
  onAdd,
  onEdit,
  onClose
}: StrengthWorkoutSuggestionsDialogProps) {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  return (
    <MoneyGoalDialog
      title="Suggested workouts"
      intro="Choose a starting point. Make it yours."
      labelledBy="strength-workout-suggestions-title"
      titleId="strength-workout-suggestions-title"
      initialFocusId={focusSourceId
        ? `strength-workout-suggestion-action-${focusSourceId}`
        : 'strength-workout-suggestions-title'}
      closeLabel="Close suggested workouts"
      bodyClassName="strength-dialog-body"
      dialogClassName="money-goal-dialog--strength-suggestions"
      onClose={onClose}
    >
      <div className="strength-workout-suggestions">
        <section className="strength-workout-suggestions__list" aria-label="Suggested workout templates">
          {strengthWorkoutSuggestions.map(suggestion => {
            const linkedWorkouts = savedWorkouts.filter(workout =>
              workout.suggestionSourceId === suggestion.sourceId
            );
            const timedSetCount = suggestion.exercises.reduce((count, exercise) =>
              count + exercise.sets.filter(set => 'targetDurationSeconds' in set).length, 0);
            const planMarkers = [
              ...(suggestion.supersetExerciseIndexes ? ['Superset'] : []),
              ...(timedSetCount ? [`${timedSetCount} timed ${timedSetCount === 1 ? 'set' : 'sets'}`] : [])
            ];
            const expanded = expandedSourceId === suggestion.sourceId && linkedWorkouts.length > 1;
            const sourceControlId = `strength-workout-suggestion-action-${suggestion.sourceId}`;
            const choiceListId = `strength-workout-suggestion-choices-${suggestion.sourceId}`;
            return (
              <article className="strength-workout-suggestion" key={suggestion.sourceId}>
                <div className="strength-workout-suggestion__content">
                  <div className="strength-workout-suggestion__heading">
                    <h3>{suggestion.name}</h3>
                    {linkedWorkouts.length > 0 && (
                      <span className="strength-workout-suggestion__added" role="status">
                        <span aria-hidden="true">✓</span> {linkedWorkouts.length === 1 ? 'Added' : `${linkedWorkouts.length} added`}
                      </span>
                    )}
                  </div>
                  <p>{suggestion.muscleIds.map(strengthMuscleName).join(' · ')}</p>
                  <p>{suggestion.exercises.length} exercises · {suggestion.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} planned sets{planMarkers.length ? ` · ${planMarkers.join(' · ')}` : ''}</p>
                  {expanded && (
                    <div
                      className="strength-workout-suggestion__choices"
                      id={choiceListId}
                      role="group"
                      aria-label={`Choose a saved ${suggestion.name} workout to edit`}
                    >
                      {linkedWorkouts.map(workout => (
                        <div className="strength-workout-suggestion__choice" key={workout.id}>
                          <div>
                            <h4>{workout.name}</h4>
                            <p>{workout.muscleIds.map(strengthMuscleName).join(' · ')}</p>
                          </div>
                          <button
                            type="button"
                            className="btn mini ghost"
                            onClick={event => onEdit(suggestion, workout, event)}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {linkedWorkouts.length === 0 ? (
                  <button
                    id={sourceControlId}
                    type="button"
                    className="btn mini"
                    onClick={event => onAdd(suggestion, event)}
                  >
                    Add
                  </button>
                ) : (
                  <button
                    id={sourceControlId}
                    type="button"
                    className="btn mini ghost"
                    aria-expanded={expanded}
                    aria-controls={linkedWorkouts.length > 1 ? choiceListId : undefined}
                    onClick={event => {
                      if (linkedWorkouts.length === 1) onEdit(suggestion, linkedWorkouts[0]!, event);
                      else setExpandedSourceId(expanded ? null : suggestion.sourceId);
                    }}
                  >
                    Edit
                  </button>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </MoneyGoalDialog>
  );
}
