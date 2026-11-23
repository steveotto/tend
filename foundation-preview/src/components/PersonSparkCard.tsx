import { useId, useState } from 'react';
import type { FriendshipConnection } from '../domain/friendships.ts';
import type { PersonPreview } from '../domain/preview-data.ts';
import { formatPersonSparkDueDate } from '../domain/home-sparks.ts';
import type { PersonSpark, PersonSparkCompletion } from '../domain/person-sparks.ts';
import { PersonBadge } from './PersonBadge.tsx';
import { RecordCardFrame } from './RecordCardFrame.tsx';

export function PersonSparkCard({
  spark,
  associatedPeople,
  linkedConnection,
  today,
  onComplete,
  onEdit,
  onPersonSelect
}: {
  spark: PersonSpark;
  associatedPeople: readonly PersonPreview[];
  linkedConnection?: FriendshipConnection;
  today: string;
  onComplete: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onEdit: (spark: PersonSpark, opener: HTMLButtonElement) => void;
  onPersonSelect: (personId: string) => void;
}) {
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);
  const completion = activeCompletion(spark);
  const completedLabel = completion
    ? formatCompletionLabel(completion, linkedConnection)
    : '';
  const statusLabel = spark.archived
    ? 'Archived'
    : spark.completed
      ? `Completed${completedLabel ? ` · ${completedLabel}` : ''}`
      : '';

  return (
    <RecordCardFrame
      className={`rhythm-card--simple person-spark-card${spark.completed ? ' person-spark-card--completed' : ''}${spark.archived ? ' person-spark-card--archived' : ''}${expanded ? ' person-spark-card--expanded' : ' person-spark-card--collapsed'}`}
      headingId={headingId}
    >
      {!expanded ? (
        <button
          type="button"
          className="person-spark-card__disclosure"
          aria-expanded="false"
          aria-label={`Expand Spark ${spark.title}`}
          onClick={() => setExpanded(true)}
        >
          <span id={headingId} className="person-spark-card__compact-title" role="heading" aria-level={3}>
            {spark.title}
          </span>
          <span className="person-spark-card__chevron" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="m7.5 4.5 5 5.5-5 5.5" />
            </svg>
          </span>
        </button>
      ) : (
        <>
          <div className="person-spark-card__title-row">
            <h3 id={headingId} className="person-spark-card__title">{spark.title}</h3>
            <button
              type="button"
              className="person-spark-card__collapse"
              aria-label={`Collapse Spark ${spark.title}`}
              aria-expanded="true"
              onClick={() => setExpanded(false)}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          {spark.description && <p className="person-spark-card__description">{spark.description}</p>}
          <div className={`person-spark-card__association-row${associatedPeople.length === 0 ? ' person-spark-card__association-row--without-people' : ''}`}>
            {associatedPeople.length > 0 && (
              <div className="person-spark-card__people" role="group" aria-label="People associated with this Spark">
                {associatedPeople.map(person => (
                  <PersonBadge
                    key={person.id}
                    person={person}
                    presentation="interactive"
                    displayNameMode="first"
                    onSelect={() => onPersonSelect(person.id)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="person-spark-card__action-row">
            {!spark.archived && !spark.completed && (
              <button
                type="button"
                className="rhythm-card__tend person-spark-card__do-it"
                onClick={event => onComplete(spark, event.currentTarget)}
              >
                Do it
              </button>
            )}
          </div>
          <footer className="person-spark-card__footer">
            <span className="person-spark-card__due-date">
              {formatPersonSparkDueDate(spark.dueDate, today)}
            </span>
            {statusLabel && <span className="person-spark-card__status">{statusLabel}</span>}
            <button
              type="button"
              className="person-spark-card__edit"
              aria-label="Edit Spark"
              onClick={event => onEdit(spark, event.currentTarget)}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m12.9 3.1 4 4M3 17l3.6-.8L16 6.8a1.8 1.8 0 0 0-2.6-2.6L4 13.5 3 17Z" />
              </svg>
            </button>
          </footer>
        </>
      )}
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
