import type { FriendshipConnection } from '../domain/friendships.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import type { PersonSpark, PersonSparkCompletion } from '../domain/person-sparks.ts';
import { PersonBadge } from './PersonBadge.tsx';
import { RecordCardFrame } from './RecordCardFrame.tsx';

export function PersonSparkCard({
  spark,
  associatedPeople,
  linkedConnection,
  onComplete,
  onEdit,
  onPersonSelect
}: {
  spark: PersonSpark;
  associatedPeople: readonly PersonPreview[];
  linkedConnection?: FriendshipConnection;
  onComplete: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onEdit: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onPersonSelect: (personId: string) => void;
}) {
  const headingId = `person-spark-title-${spark.id}`;
  const completion = activeCompletion(spark);
  const completedLabel = completion
    ? formatCompletionLabel(completion, linkedConnection)
    : '';

  return (
    <RecordCardFrame
      className={`rhythm-card--simple person-spark-card${spark.completed ? ' person-spark-card--completed' : ''}${spark.archived ? ' person-spark-card--archived' : ''}`}
      headingId={headingId}
    >
      <div className="person-spark-card__title-row">
        {spark.completed && <span className="person-spark-card__check" aria-hidden="true">✓</span>}
        <h3 id={headingId} className="person-spark-card__title">{spark.title}</h3>
        <button
          type="button"
          className="person-spark-card__edit"
          aria-label={`Edit ${spark.title}`}
          onClick={event => onEdit(spark, event.currentTarget)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
            <path d="m12.9 3.1 4 4M3 17l3.6-.8L16 6.8a1.8 1.8 0 0 0-2.6-2.6L4 13.5 3 17Z" />
          </svg>
        </button>
      </div>
      {spark.description && <p className="person-spark-card__description">{spark.description}</p>}
      <div className="person-spark-card__body">
        {associatedPeople.length > 0 && (
          <div className="person-spark-card__people" role="group" aria-label="People associated with this Spark">
            {associatedPeople.map(person => (
              <PersonBadge
                key={person.id}
                person={person}
                presentation="interactive"
                displayNameMode="full"
                onSelect={() => onPersonSelect(person.id)}
              />
            ))}
          </div>
        )}
        {!spark.archived && !spark.completed && (
          <button
            type="button"
            className="person-spark-card__do-it"
            onClick={event => onComplete(spark, event.currentTarget)}
          >
            Do it
          </button>
        )}
      </div>
      <footer className="person-spark-card__footer">
        <span className="person-spark-card__footer-label">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
            <path d="m10 1.5 1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9L10 1.5Z" />
          </svg>
          <span>
            {spark.archived
              ? 'Archived'
              : spark.completed
                ? completedLabel || 'Completed'
                : 'Someday'}
          </span>
        </span>
      </footer>
    </RecordCardFrame>
  );
}

function activeCompletion(spark: PersonSpark): PersonSparkCompletion | null {
  for (let index = spark.completionHistory.length - 1; index >= 0; index--) {
    const completion = spark.completionHistory[index];
    if (completion && completion.undone !== true) return completion;
  }
  return null;
}

function formatCompletionLabel(
  completion: PersonSparkCompletion,
  linkedConnection?: FriendshipConnection
): string {
  if (completion.completedAt) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(completion.completedAt));
  }
  if (!completion.date) return 'Completed';
  const date = formatDate(completion.date);
  const time = linkedConnection?.time ?? completion.time;
  return time ? `${date} · ${formatTime(time)}` : date;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}
