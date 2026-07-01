# v0.9 Alpha - Engine Foundation

## Added
- Property Intelligence Record generation.
- Parcel-first property IDs where parcel data exists.
- Standard Signal objects.
- Standard Evidence objects.
- Organization normalization for owners, contractors, and applicants when exposed.
- Additional output files: `properties.json`, `organizations.json`, `signals.json`, and `evidence.json`.

## Improved
- Permit clusters now feed property records instead of only dashboard cards.
- Permit clusters use parcel IDs as stronger identifiers when available.
- Dashboard format remains unchanged from the preferred layout.

## Notes
- Contractor/applicant enrichment is limited to fields exposed by the public permit GIS layer. A secondary permit-detail lookup is still required for richer contractor data.
- GIS parcel enrichment and Register of Deeds ownership history are next certified connector targets.
