import type { GoalTimeline } from '../domain/money-goals.ts';

type TimelineChartProps = {
  timeline: GoalTimeline;
  valueLabel: string;
  formatValue: (value: number) => string;
};

const width = 640;
const height = 220;
const margin = { top: 18, right: 18, bottom: 36, left: 18 };

export function TimelineChart({ timeline, valueLabel, formatValue }: TimelineChartProps) {
  const start = timeline.planned[0];
  const target = timeline.planned[1];
  const values = [...timeline.planned, ...timeline.actual].map(point => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * 0.12, 100);
  const minimum = low - padding;
  const maximum = high + padding;
  const startMillis = Date.parse(`${start.date}T00:00:00Z`);
  const endMillis = Math.max(
    Date.parse(`${target.date}T00:00:00Z`),
    Date.parse(`${timeline.actual.at(-1)?.date ?? target.date}T00:00:00Z`)
  );
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const point = (date: string, value: number) => {
    const dateMillis = Date.parse(`${date}T00:00:00Z`);
    const x = margin.left + ((dateMillis - startMillis) / (endMillis - startMillis)) * plotWidth;
    const y = margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
    return { x, y };
  };
  const plannedStart = point(start.date, start.value);
  const plannedEnd = point(target.date, target.value);
  const accessibleLabel = `Planned linear trajectory from ${formatValue(start.value)} on ${start.date} to ${formatValue(target.value)} on ${target.date}, with ${timeline.actual.length} dated observed ${valueLabel} check-in${timeline.actual.length === 1 ? '' : 's'}.`;

  return (
    <figure className="goal-timeline">
      <figcaption className="goal-timeline__caption">
        <strong>Planned linear trajectory</strong>
        <span>From {formatValue(start.value)} on {start.date} to {formatValue(target.value)} on {target.date}.</span>
        <span>Dots show observed check-ins only; no {valueLabel} is inferred between dates.</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={accessibleLabel}>
        <line
          className="goal-timeline__planned"
          x1={plannedStart.x}
          y1={plannedStart.y}
          x2={plannedEnd.x}
          y2={plannedEnd.y}
        />
        {timeline.actual.map((checkIn, index) => {
          const coordinates = point(checkIn.date, checkIn.value);
          return (
            <circle
              key={`${checkIn.date}-${index}`}
              className="goal-timeline__actual"
              cx={coordinates.x}
              cy={coordinates.y}
              r="6"
            >
              <title>{`${checkIn.date}: ${formatValue(checkIn.value)}`}</title>
            </circle>
          );
        })}
        <text className="goal-timeline__date" x={margin.left} y={height - 8} textAnchor="start">{start.date}</text>
        <text
          className="goal-timeline__date"
          x={point(target.date, target.value).x}
          y={height - 8}
          textAnchor="end"
        >
          {target.date}
        </text>
      </svg>
      <div className="goal-timeline__legend" aria-hidden="true">
        <span><i className="is-planned" />Plan</span>
        <span><i className="is-observed" />Observed check-in</span>
      </div>
    </figure>
  );
}
