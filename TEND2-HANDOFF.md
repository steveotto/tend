# Tend 2 Foundation handoff

## Workspace
- Path: `/Users/ice/dev/copilot-worktrees/steveotto_tend/gh11-tend2-foundation`
- Branch: `gh11-tend2-foundation`
- Base HEAD before the checkpoint commit: `2d4fbe31d5c57d0715a709e8cc049862b831366e`
- The final checkpoint is prepared from this existing worktree and branch. Opening a branch elsewhere does not transfer this worktree or session context; use the pushed commit to obtain the files.

## Current task
Final Tend 2.0 synthetic-preview checkpoint: review the complete worktree, verify the full test/typecheck/build set, record limitations, and prepare only the intended source, tests and documentation for the requested checkpoint commit and normal push.

The shared compact RhythmCard keeps its 44×44px Info hit target and direct Tend action. Info opens the shared details dialog; Today and dialog Tend actions use the same idempotent completion state. The visible Info circle is neutral gray, about 31×31px, with a centered 13px path-drawn italic “i”; it aligns vertically with Tend.

Current refinement keeps the compact status on a full-width bottom row aligned with Tend. Incomplete status is calendar icon then text; completed status is Undo icon, calendar icon, then text. Undo is a 44×44px icon-only target with accessible name and tooltip “Undo completion for [Rhythm]”; there is no hidden Undo slot when incomplete. Its SVG viewBox frames the measured path bounds so the arrow is visually centered within the target and aligns with the calendar icon/status text.

Tend and Tended remain 92×44px. Tend retains mint styling; disabled Tended uses neutral light gray, a subtle gray border and readable muted ink, with no opacity reduction or checkmark. The full dialog uses one horizontal inset token for title, body and footer content. The divider remains full width; title/description/persons and right edges of Close/Tend align with the footer content edges. Recurrence/time remain left, status right.

The full dialog uses one shared compact two-column layout: description, associated people and only fixture-linked foundation icons on the left; supported Tend and score/history controls on the right. The footer groups recurrence/time on the left and last-tended status on the right. History opens as a view within the dialog; Back returns focus to the history control, and close/Escape returns focus to the originating Info button. No Edit control is shown because no working rhythm editor exists in this preview.

Score/history buttons show the fixture score and chart icon using the requested bands: green at 80+, yellow above 40 and below 80, red at 40 and below; unavailable (`null`) remains an em dash with a neutral button. The exact 40 boundary is red, honoring “40 and below.” No score formula or persistence behavior was added.

## State
- `RhythmCard` has typed `simple`, `suggestion`, and catalogue variants. Today simple cards expose Info and Tend; Marriage Today/Foundation rows and suggestions expose Info only; the catalogue retains its descriptive catalogue presentation.
- `RhythmDetailsDialog` is shared. Today alone passes the Tend capability; Marriage details are read-only. The dialog uses shared `PersonBadgeList`, `RhythmMetadata`, and `MarriageIcon`; category icons are derived only from the rhythm’s actual synthetic foundation associations. Person navigation closes the dialog before routing. Completion remains routed through `App.tend` and existing preview autosave.
- `RhythmCard` simple variant renders sibling Info and optional Tend controls; Info immediately precedes Tend. `TodayView` supplies `App.tend` as the card callback. Marriage simple/suggestion variants omit that callback.
- Compact cards and the details dialog share `RhythmCompletionActions` for fixed-size Tend/Tended controls and `RhythmMetadata` for calendar/status and inline Undo presentation. `App.tend` and `App.undoTend` are the shared state commands; duplicate Tend and stale/repeated Undo are guarded. Undo removes only that rhythm’s ID from `completedRhythmIds` and leaves other IDs and fixture history untouched.
- Tended uses the shared action component with disabled semantics and readable neutral styling. Completion is announced through a polite live region. Undo appears only for eligible completed IDs and is absent when incomplete; when focused, it moves focus to that rhythm’s Tend button after the state update.
- Focused assertions cover direct Tend, duplicate prevention/completed state, Info launching the correct dialog, shared card/dialog completion and persistence, independent person navigation, read-only Marriage, optional content, associated categories, score bands (including 80 and 40 boundaries), unavailable vs. zero scores, dated history, Back focus, Escape/close focus restoration, and the path-only decorative Info SVG.
- Focused completion assertions also cover Tend and Undo from both surfaces, only-selected-ID removal, remount persistence, no mutation in read-only contexts, keyboard activation, accessible completion announcement and focus after Undo.
- The latest focused tests verify no decorative checkmark in compact or full-dialog Tended, disabled completion state, calendar/status order, absent Undo while incomplete, completed Undo/calendar/status order, icon-only Undo with its accessible name/tooltip, shared state, keyboard Undo, persistence and focus return.
- The details-dialog score/history control is 80×44px. Read-only Marriage dialogs omit Tend; Today dialogs expose the existing shared completion action.
- Old stylesheet rules for the prior Today-specific card/actions remain but are not matched by the current simple-card markup. They were left untouched; cleanup is outside this task.

## Files included in the checkpoint
`README.md`; `TEND2-HANDOFF.md`; `foundation-preview/src/App.tsx`; `CatalogApp.tsx`; `components/AppNavigation.tsx`; `components/Cards.tsx`; `components/MarriageExampleSelector.tsx`; `components/MarriageIcon.tsx`; `components/MarriageView.tsx`; `components/PersonBadge.tsx`; `components/PersonProfilePlaceholder.tsx`; `components/RhythmCompletionActions.tsx`; `components/RhythmDetailsDialog.tsx`; `components/RhythmMetadata.tsx`; `components/TodayView.tsx`; `domain/preview-data.ts`; `styles.css`; `tests/app-preview.component.test.tsx`; `tests/components.component.test.tsx`; `tests/preview-storage.component.test.tsx`.

The Marriage preview, synthetic people, person badges, Today example selector, meter treatment, Foundation rows and other pre-existing changes are part of this checkpoint. Preserve all of them; do not reset, stash, delete, clean, switch branches, or create another worktree.

## Reuse map and repository rules
- `RhythmCard` / internal `SimpleRhythmCard` → Today, Marriage Today, Marriage Foundation supporting-rhythm rows, Marriage suggestions (`suggestion` variant), and catalogue (`catalogue` variant).
- `RhythmDetailsDialog` → shared App dialog for Today and Marriage; mutation capability is supplied only for actionable Today items.
- `RhythmMetadata` → compact status line and shared details footer; its internal status/Undo presentation is reused across both placements.
- `RhythmCompletionActions` → compact cards and full details dialog for the shared Tend/Tended control and completion announcement.
- `PersonBadgeList` → shared card variants and details dialog.
- `MarriageExampleSelector` → Today and Marriage; selector state is in-memory.
- Remaining reasonable exception: catalogue cards retain their descriptive layout rather than the compact action-card layout; suggestions retain a dedicated shared variant because their purpose differs. No category-specific duplicate card/dialog implementation was added.
- Architecture verification is via typed props and runtime/component tests; there is no separate static architecture checker. These tests do not prove visual parity or cover every viewport.
- Follow `AGENTS.md`: synthetic fixtures only; keep the existing app and live data unchanged; pure typed domain selectors; no legacy `ensureShape`; reuse shared components; preserve the existing preview storage format and safeguards; no scoring formulas, deployment wiring, schema cleanup, merge or deployment. The requested checkpoint commit/push is specifically authorized.

## Checks and preview
- Final full checks against the reviewed source: `cd foundation-preview && npm test` passed (reader 7/7, component 69/69 across 4 files, legacy 175/175); `cd foundation-preview && npm run typecheck` passed; `cd foundation-preview && npm run build` passed. Build warning remains: `/tend.css doesn't exist at build time; it will remain unchanged to be resolved at runtime`.
- `git diff --check` passed after the final handoff update. No source changes followed the passing tests, typecheck or build.
- Browser inspection at 488×970: page width and scroll width were both 488px. Compact cards measured 464×142px before, after Tend and after Undo. Tend/Tended measured 92×44px in both states; Info was 44×44px; Undo was 44×44px and absent when incomplete. In the completed state, Undo target and its 16×16px SVG, calendar SVG and status text shared the same vertical center (y=559px); SVG path bounds were inspected and the viewBox adjusted to center its artwork rather than applying a positional offset. Tended computed to `rgb(241, 242, 241)` background, `rgb(215, 218, 216)` border, `rgb(94, 107, 99)` text, opacity 1. The compact status text right edge x=461 matched Tend’s right edge; no overflow or overlap was present.
- Full details dialog measured 456px wide without page overflow. Incomplete and completed checks confirmed title, description, badges and footer content share x=33px left edge; Close, Tend and footer content share x=455px right edge. The divider remains full width (x=17–471px). Tend/Tended remained 92×44px. Completed Undo icon/calendar/text shared a y=606.5px center and Undo remained 44×44px. Undo activation returned focus to Tend, removed the synthetic completion ID from preview storage, and restored the original 0-of-3 sample state. Footer wrapping below 488px was not visually verified.
- Browser screenshots were captured for incomplete and completed compact cards and the full dialog. The preview’s original 0-of-3 completion state was restored after interaction.
- Preview server check: the current listener on `127.0.0.1:4173` is Vite PID 14876 from this worktree’s `foundation-preview`; `http://127.0.0.1:4173/app-preview.html` returned HTTP 200. It is still running. Do not stop it unless its identity is checked again or switch ports.
- Preview command if needed: `cd /Users/ice/dev/copilot-worktrees/steveotto_tend/gh11-tend2-foundation/foundation-preview && npm run dev -- --port 4173 --strictPort`

## Final review and limitations
- The reviewed change set is confined to `README.md`, this handoff, and `foundation-preview` source/tests. No legacy app files, dependency manifests/lockfiles, generated output, assets, credentials or personal data are changed. Fixtures/person labels are synthetic; browser persistence remains restricted to `tend2:synthetic-preview`.
- Reuse map and variant exceptions are listed above. Runtime component tests and typed props protect behavior; there is no static architecture checker, and those checks do not prove visual parity or every viewport.
- Browser validation was at 488×970 only. Narrower widths, large-text layouts and wrapping below 488px remain visually unverified. The measured shared action/status dimensions and alignments are recorded above.
- Known limitation: localStorage compare-before-write is not an atomic cross-tab transaction. Two tabs can race between checking the stored snapshot and writing, so concurrent writes may overwrite one another despite existing corruption/conflict safeguards. This race was not changed or tested as part of this checkpoint.
- No implementation work remains in scope. The requested checkpoint subject is `Refine shared Tend cards and Marriage preview`; final commit hash and remote verification belong in the delivery summary. No merge or deployment is authorized.

## Safety
Synthetic preview only. No live data or account connections, legacy app edits, scoring changes, or persistence-format changes without explicit authorization. This checkpoint's requested commit and push are authorized; no merge or deployment is authorized.
