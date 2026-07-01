# Technical Decisions

## Decision 001 - Generated data is not committed
Reason: Avoid merge conflicts and keep source code separate from generated intelligence.

## Decision 002 - GitHub Pages + GitHub Actions first
Reason: Free hosting and automation while proving the product.

## Decision 003 - Connector-first architecture
Reason: Each data source can fail or change without breaking the whole platform.

## Decision 004 - Commercial-only filtering in the engine
Reason: Keep business logic consistent across all connectors.
