# PI PERM-001a Official Mecklenburg Permit Connector Fix

## Fixed
- Replaced the incorrect permit FeatureServer with Mecklenburg's Accela Building Permits FeatureServer.
- Updated field mapping from legacy names to live Accela field names.
- Reads `permit_number`, `permit_type`, `issue_date`, `project_address`, `description_of_work`, `owner_name`, construction cost, parcel, units, and square footage where available.
- Normalizes official permit records into Capital Improvement opportunities.

## Validation
- Unit tests pass.
- Connector now targets the official Mecklenburg ArcGIS REST layer that supports JSON queries.
