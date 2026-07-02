# Commercial Property Intelligence Architecture

Commercial Property Intelligence is property-first. Public records, permits, incidents, ownership activity, and news are converted into signals and attached to Property Intelligence Records.

## Current Layers

1. Source Integration
   - Fire/news signals
   - Mecklenburg Building Permits
   - Mecklenburg GIS parcel enrichment

2. Core Engine
   - Qualification
   - Property Resolver
   - Organization Resolver
   - Signal Engine
   - Evidence Engine
   - Opportunity Engine

3. Intelligence Workspace
   - Executive summary
   - Today's Opportunities
   - Property Intelligence Records
   - Organization Resolver
   - Source Health
   - Intelligence QA

## v0.9.3 Change

The v0.9.3 build keeps the existing data pipeline unchanged and improves the workspace layer with sorting, filtering, search, heat indicators, chronological timeline ordering, and collapsed internal diagnostics.


## v0.9.10 Social / Public Agency Layer

Public agency and social-web indexed sources are monitored as a supporting evidence layer. Official public agency sources receive stronger confidence than general social/public web results. These signals are not CRM activity and do not track outreach, follow-up, or sales outcomes.


## v0.9.16 Pilot Hardening

The pilot build adds diagnostics around rejected records, temporary/event permits, incidents, social/public-web records, and source health so the platform can be tuned using live data.


## v0.9.18 Ownership Validation
Ownership data is resolved in layers: permit owner fields first, GIS owner fields second, and Register of Deeds planned as the authoritative ownership-change connector.
