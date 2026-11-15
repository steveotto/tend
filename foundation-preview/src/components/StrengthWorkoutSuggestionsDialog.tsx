import { useState } from 'react';
import type { MouseEvent } from 'react';
import { strengthMuscleName, strengthWorkoutSuggestions } from '../domain/strength.ts';
import type { StrengthSavedWorkout, StrengthWorkoutSuggestion } from '../domain/strength.ts';

type StrengthWorkoutSuggestionsDialogProps = {
  savedWorkouts: readonly StrengthSavedWorkout[];
  hasDraft?: boolean;
  onCreate: (event: MouseEvent<HTMLButtonElement>) => void;
  onContinueEditing?: () => void;
  onAdd: (suggestion: StrengthWorkoutSuggestion, event: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (
    suggestion: StrengthWorkoutSuggestion,
    workout: StrengthSavedWorkout,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
};

export function StrengthWorkoutSuggestionsDialog({
  savedWorkouts,
  hasDraft = false,
  onCreate,
  onContinueEditing,
  onAdd,
  onEdit
}: StrengthWorkoutSuggestionsDialogProps) {
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);

  return (
      <div className="strength-workout-suggestions" aria-labelledby="strength-workout-suggestions-title">
        <section className="strength-workout-suggestions__create" aria-label="Create a workout">
          <div>
            <h3>Create your own</h3>
            <p>Choose exercises, sets, and reps.</p>
          </div>
          <button type="button" className="btn mini ghost" onClick={onCreate}>Create</button>
          {hasDraft && onContinueEditing && (
            <button type="button" className="strength-workout-suggestions__continue" onClick={onContinueEditing}>
              Continue editing
            </button>
          )}
        </section>
        <section className="strength-workout-suggestions__list" aria-label="Starter routines">
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
                  <details className="strength-workout-suggestion__preview">
                    <summary>Preview routine</summary>
                    <ol>
                      {suggestion.exercises.map(exercise => (
                        <li key={exercise.name}>
                          <strong>{exercise.name}</strong>
                          <span>{exercise.equipment} · {exercise.sets.map(formatSuggestionSet).join(' / ')}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
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
                    Customize
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
  );
}

function formatSuggestionSet(set: StrengthWorkoutSuggestion['exercises'][number]['sets'][number]): string {
  if ('targetDurationSeconds' in set) {
    const minutes = Math.floor(set.targetDurationSeconds / 60);
    const seconds = set.targetDurationSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  return `${set.targetReps} reps`;
}
