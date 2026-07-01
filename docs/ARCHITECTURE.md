# Architecture

PI is built around an intelligence engine, not a dashboard.

Public Sources -> Connectors -> Normalization -> Opportunity Engine -> Scoring -> Dashboard

## Key Decisions
- Connectors never talk directly to the dashboard.
- Generated intelligence is created during GitHub Actions deployment and is not committed back to Git.
- Scoring happens in the central opportunity engine.
- Configuration controls territory, exclusions, services, and watch lists.
