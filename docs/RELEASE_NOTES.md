# PI v0.2.0 Developer Preview

## Added
- End-to-end GitHub Actions deployment without committing generated data
- Commercial Fire Intelligence using Google News RSS queries
- Fire/commercial classifier
- Residential/noise filters
- Opportunity scoring and confidence scoring
- Source Health panel
- Rejected Sample panel for validation
- CSV export

## Purpose
This release exists to prove that PI can retrieve a live public source, classify events, generate opportunities, and publish a dashboard.

## Known limitations
- This is not yet a full permit connector.
- Google News is a validation source, not the final source strategy.
- Property owner/management fields require future property-record enrichment.
- Some valid fire opportunities may be missed until source coverage expands.
