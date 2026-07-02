# v0.9.13 Alpha - Permit Scope Exclusion

## Fixed
- Excludes temporary/festival/event permit scopes from the opportunity queue.
- Blocks festival stages, temporary tents, booths, amusement rides, event permits, signs/banners, generators, food trucks, and related non-building scopes.
- Keeps legitimate commercial alteration, roofing, envelope, waterproofing, fire/water damage, structural, interior, and capital improvement permits.

## Why
Temporary event permits are technically building permits in the county dataset, but they are not target opportunities for commercial restoration, reconstruction, or capital improvement prospecting.

## Validation
- Added tests for Taste of Charlotte festival stage/no-review building permit exclusion.
- Existing fire, incident, social, and commercial permit tests retained.
