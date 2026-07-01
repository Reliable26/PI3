# Engineering Decisions

## Decision 001 - Generated intelligence is not committed to Git
Reason: Avoids merge conflicts and keeps source code separate from generated data.

## Decision 002 - Connectors do not score opportunities
Reason: Scoring must be consistent across all sources.

## Decision 003 - Dashboard reads only published intelligence payload
Reason: The dashboard is a view, not the intelligence engine.
