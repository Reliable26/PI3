# Reliable Intel v0.9.1 Alpha - Property Resolver / GIS Enrichment

## Added
- Mecklenburg parcel GIS lookup for permit clusters.
- Property Resolution panel on opportunity cards.
- GIS source and GIS query links for parcel verification.
- GIS lookup metrics in dashboard summary.
- Property Intelligence Records now preserve GIS resolution details when matched.

## Kept
- Existing dashboard layout.
- Existing permit clustering.
- Existing fire intelligence and strict territory filtering.

## Notes
- GIS enrichment uses parcel IDs from the official Mecklenburg Building Permits feed.
- If a permit record does not include a usable parcel ID, it remains address-clustered.
- Ownership and management enrichment are still separate upcoming connectors.
