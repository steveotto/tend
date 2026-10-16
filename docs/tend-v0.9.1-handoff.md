# Tend v0.9.1 checkpoint

- **Branch:** `gh9-tend-v0-9-1`, based on current `main` at `1be560e` (PR #43).
- **Checkpoint commit:** `c0010a37ec6c2cce8a585db1377e4a2f4fe3f84b`.
- **Push:** pushed normally to `origin`; no force-push.
- **Comparison:** https://github.com/steveotto/tend/compare/main...gh9-tend-v0-9-1
- **Version:** v0.9.1. No uncommitted implementation files remain after the checkpoint.

## Completed work

- T05 rhythm ordering and Today interaction polish are in the current `main` through PR #43.
- T06 Me profile, T07 compact four-tab Settings, and T08 Marriage rhythm suggestions, identity-based linking, and shared picker refinements are checkpointed on this branch.
- Profile save handling and repeatable profile-permission SQL migrations are included. The user reported profile saving fixed; whether the permissions migration was applied is unconfirmed. No production SQL was applied here.

## Verification and follow-up

- The repository suite passed: 128 tests. Changed JavaScript syntax checks and `git diff --check` passed.
- Authenticated Marriage suggestion/picker flows and mobile layouts still need verification; the local preview stopped at sign-in.
- Next: verify Marriage suggestion and picker flows, then design the full Marriage page.
