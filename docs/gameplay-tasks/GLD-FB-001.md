# GLD-FB-001 - In-Run Cause Rows

Status: Done

Shared feedback cause rows live in `src/shared/long-run-feedback.ts` through `getInRunCauseRows`. The read model summarizes objective progress, claimed pickups, hazard events, route context, Perfect Memory lock state, and economy changes without renderer-only logic or scoring changes.
