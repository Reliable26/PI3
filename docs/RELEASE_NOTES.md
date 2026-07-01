# PERM-002 - Property-First Permit Clustering

## Added
- Groups permits by address/parcel into one property opportunity.
- Adds permit timeline inside each opportunity card.
- Adds total permit value for each address cluster.
- Adds official permit detail links per permit.
- Adds contractor/filer placeholder when the public GIS layer does not expose contractor detail.
- Adds permit address cluster metric.

## Notes
- The official BuildingPermits GIS layer exposes permit and owner fields, but contractor/applicant fields may be blank or unavailable. Contractor enrichment is now separated as CONT-001 and will require a secondary detail lookup/source.
