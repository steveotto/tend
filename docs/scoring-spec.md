# Tend Scoring Spec — One Engine, App-Wide

**Goal:** Replace all existing scoring (fitness log-based scores, legacy Marriage scoring, the recency-only `rhythmScore()`, and the React preview's variant) with ONE scoring engine used everywhere.

## The hierarchy

```
Rhythms -> Foundations -> Categories -> Overall Health

```

- A rhythm's scores roll up to every Foundation it is linked to (a rhythm linked to two foundations contributes to both).
- Foundation scores roll up to their Category; Category scores roll up to Overall Health.

## Rhythm-level scores

Every rhythm gets two scores, computed from its logged occurrences:

**Consistency** = completed due occurrences / due occurrences, over a cadence-specific window:

| Cadence | Window |
| --- | --- |
| Daily | 30 days |
| Weekly | 12 weeks |
| Monthly | 6 months |
| Quarterly | 12 months |
| Yearly | 24 months |

**On Track** = starts at 100, loses 10 per consecutive missed occurrence, floors at 0, resets to 100 on a qualifying completion. Misses are counted only from the rhythm's score-clock start (see below).

## Score-clock rule (new rhythms and backdating)

A rhythm's scoring clock starts at its **first log entry** or at **creation**, whichever is earlier in effect:

- Created with no logs: "not scored yet" until the first occurrence comes due. Grace ends at the first DUE date, not the first completion - an abandoned rhythm cannot hide unscored forever.
- Backdated log entries count as normal evidence: the rhythm is scored exactly as if it had existed since the first logged date. Backdating is not a special mode; the engine just reads evidence.
- Before the clock starts, nothing counts in either direction (no credit, no misses).

## Rollups (all levels, one rule)

- **Plain equal averages.** All rhythms of a foundation are averaged; all foundations of a category are averaged; all categories are averaged for Overall. No frequency weighting - a quarterly rhythm counts as much as a daily one (importance is not frequency; this was decided deliberately).
- **Unscored is never zero.** Any level with no scored children shows "not yet scored" and is excluded from its parent's average. Applies at every level.
- **Blend on every card.** Every card (rhythm, foundation, category, overall) leads with ONE headline number: `0.75 x Consistency + 0.25 x On Track`, with the two component scores shown beneath or on tap. The blend uses each level's own averaged components.

## What is NOT a scoring input (diagnostic only)

Charts and tracking data show "what needs attention" but never feed scores:

- Strength muscle / body map (muscle-group tracking)
- Weekly run-count and mileage goals and the run chart
- Weigh-ins, weight goals, and the weight trajectory
- Flexibility stretch-region tracking

Flexibility scores come only from rhythms linked to the Flexibility foundation (none exist yet - it will show "not yet scored" until one is linked).

## UI requirements

- Empty states name the missing action, not the missing data: "Scores appear after your first M/W/F workout."
- Foundation and category cards carry a scored-count caption: "2 of 3 rhythms scored."
- The score-explainability card (Consistency/On Track breakdown, 75/25) is now truthful app-wide.

## Explicitly out (do not carry over)

- Legacy evidence-based fitness scoring: strength decay from muscleIntervals, cardio lower-of-two-goals, weight trajectory scoring (this also retires the stale-weigh-in bug).
- The generic recency-only `rhythmScore()` in app-core.js.
- The Marriage frequency-weight scheme (5/3/1) and the 0.90 single-rhythm breadth factor.
- The primary/supporting Foundation-link roles for scoring (per PR #57 decision: all links count equally).
