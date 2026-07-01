# Release Notes - PI v0.2.4 PERM-001

## Added
- Official Mecklenburg Building Permits ArcGIS FeatureServer connector.
- Permit classification for Roofing, Waterproofing, Building Envelope, Exterior Renovation, Commercial Alteration, Fire Restoration, Water Damage, Structural Repair, and Capital Improvement.
- Capital Improvement opportunity class.
- Permit source-health reporting.
- Permit records retrieved dashboard metric.

## Preserved
- Previous dashboard format.
- Fire Intelligence pipeline.
- Strict territory filter for news/fire results.
- Source links and published dates.

## Notes
This connector validates the official ArcGIS permit layer first. If records are stale or not detailed enough, the next step is to connect the Daily Building Permits Issued report or another structured source.
