import type { ReactNode } from 'react';
import type { CardioActivityType } from '../domain/cardio.ts';

export type CardioSummaryMetric = {
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string | undefined;
  note: string;
};

export function CardioActivitySummary({
  title,
  subtitle,
  headingId,
  metrics,
  headingIcon,
  explanation,
  className = ''
}: {
  title: string;
  subtitle?: string;
  headingId: string;
  metrics: readonly CardioSummaryMetric[];
  headingIcon?: ReactNode;
  explanation?: string;
  className?: string;
}) {
  return (
    <section
      className={`cardio-activity-summary cardio-run-summary ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <header className="cardio-activity-summary__heading cardio-run-summary__heading">
        {headingIcon && (
          <span className="cardio-activity-summary__heading-icon" aria-hidden="true">{headingIcon}</span>
        )}
        <div>
          <h2 id={headingId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <dl className="cardio-activity-summary__metrics cardio-run-summary__metrics">
        {metrics.map(metric => (
          <div className="cardio-activity-summary__metric cardio-run-summary__metric" key={metric.key}>
            <span className="cardio-activity-summary__icon cardio-run-summary__icon" aria-hidden="true">{metric.icon}</span>
            <dt>{metric.label}</dt>
            <dd>
              <span className="cardio-activity-summary__value">
                <strong>{metric.value}</strong>
                {metric.unit && ' '}
                {metric.unit && <span className="cardio-activity-summary__unit">{metric.unit}</span>}
              </span>
              <small>{metric.note}</small>
            </dd>
          </div>
        ))}
      </dl>
      {explanation && <p className="cardio-activity-summary__explanation">{explanation}</p>}
    </section>
  );
}

export function CardioRunnerIcon() {
  return (
    <svg viewBox="0 0 1167 1280" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <g transform="translate(0.000000,1280.000000) scale(0.100000,-0.100000)"
        fill="currentColor" stroke="none">
        <path d="M9270 12789 c-229 -29 -473 -124 -657 -256 -272 -194 -468 -494 -539
-825 -25 -114 -25 -369 -1 -491 94 -472 445 -861 918 -1021 167 -56 260 -70
459 -70 199 0 292 14 459 70 400 135 727 449 864 829 50 141 70 257 71 425 1
176 -11 259 -59 406 -165 505 -614 864 -1166 934 -96 12 -254 11 -349 -1z" />
        <path d="M5145 10889 c-80 -12 -193 -69 -252 -127 -42 -41 -1667 -2180 -1780
-2342 -24 -35 -54 -97 -69 -143 -23 -69 -27 -100 -27 -197 -1 -103 2 -124 29
-200 70 -200 212 -329 394 -362 128 -22 284 28 378 123 27 27 397 512 823
1078 l774 1030 443 0 443 1 -19 -27 c-11 -16 -769 -1026 -1684 -2246 l-1664
-2219 -1215 -1 -1214 -2 -68 -27 c-93 -38 -164 -87 -239 -166 -323 -343 -232
-974 171 -1186 134 -70 29 -66 1631 -66 1549 0 1541 0 1705 51 124 38 264 118
331 190 18 19 321 405 674 859 354 454 648 831 655 838 10 11 162 -154 768
-832 417 -465 757 -852 757 -860 0 -9 -140 -728 -311 -1598 -223 -1137 -312
-1611 -316 -1681 -21 -363 196 -688 508 -762 302 -71 612 129 718 465 11 36
180 886 376 1890 195 1004 376 1926 401 2049 40 196 45 239 46 355 0 197 -40
357 -124 486 -27 42 -731 859 -1325 1537 l-55 62 728 968 c400 532 728 969
729 971 1 1 211 -240 467 -535 256 -296 489 -560 517 -586 63 -59 178 -115
260 -127 144 -20 301 37 430 156 98 91 1610 1844 1649 1912 57 100 77 181 76
317 0 87 -5 137 -18 180 -49 163 -154 293 -292 361 -77 39 -79 39 -193 39
-104 -1 -122 -3 -174 -27 -32 -15 -77 -41 -100 -58 -24 -17 -328 -358 -677
-760 -349 -401 -638 -728 -641 -727 -4 1 -354 402 -780 891 -440 506 -796 907
-827 931 -30 24 -80 55 -111 71 -127 62 -38 58 -1401 60 -685 1 -1272 -2
-1305 -7z" />
      </g>
    </svg>
  );
}

export function CardioWalkIcon() {
  return (
    <svg viewBox="0 0 128 128" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M67.9,22.6c5.7,0.4,10.8-3.8,11.3-9.7c0.4-5.7-3.8-10.8-9.7-11.3c-5.7-0.4-10.8,3.8-11.3,9.7C57.8,17.1,62.2,22.2,67.9,22.6"/>
      <path d="M59,26.9c2-1.5,4.5-2.3,7.3-2.2c3.5,0.3,6.6,2.5,8.3,5.1l10.5,20.9l14.3,10c1.2,1,2,2.5,1.9,4.1c-0.1,2.6-2.5,4.5-5.1,4.2
  c-0.7,0-1.5-0.3-2.2-0.7L78.6,57.8c-0.4-0.4-0.9-0.9-1.2-1.5l-4-7.8l-4.7,20.8l18.6,22c0.4,0.7,0.7,1.5,0.9,2.2l5,26.5
  c0,0.6,0,1,0,1.5c-0.3,4-3.7,6.7-7.6,6.6c-3.2-0.3-5.6-2.6-6.4-5.6l-4.7-24.7L59.4,81l-3.5,16.1c-0.1,0.7-1.2,2.3-1.5,2.9L40,124.5
  c-1.5,2.2-3.8,3.7-6.6,3.4c-4-0.3-6.9-3.7-6.6-7.6c0.1-1.2,0.6-2.2,1-3.1l13.5-22.5L52.5,45l-7.3,5.9l-4,17.7c-0.4,2.2-2.6,4.1-5,4
  c-2.6-0.1-4.5-2.5-4.4-5.1c0-0.1,0-0.4,0.1-0.6l4.5-20.6c0.3-0.9,0.7-1.6,1.5-2.2L59,26.9z"/>
    </svg>
  );
}

export function CardioActivityTypeIcon({ type }: { type: CardioActivityType }) {
  return type === 'run' ? <CardioRunnerIcon /> : <CardioWalkIcon />;
}

export function CardioStopwatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 2h6m-3 0v3m5.7 2.3 1.4-1.4" />
    </svg>
  );
}

export function CardioFlameIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path fill="#F97316"
        d="M32 6 C26 14 16 22 16 37 C16 49 23 58 32 58 C41 58 48 49 48 37 C48 28 42 21 37 11 C35 16 33 18 30 19 C31 14 31 10 32 6 Z" />
      <path fill="#FBBF24"
        d="M32 58 C27 58 24 54 24 49 C24 44 28 41 32 36 C36 41 40 44 40 49 C40 54 37 58 32 58 Z" />
    </svg>
  );
}
