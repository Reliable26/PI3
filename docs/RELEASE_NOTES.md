# PI v0.2.2c — Format Rollback + Strict Territory Qualification

## Fixed
- Restores the prior dashboard layout/format from v0.2.2b.
- Removes the looser source-based territory logic that allowed out-of-market articles.
- Rejects local-outlet world/national/international syndicated articles unless the article text itself contains target territory terms.
- Adds section rejection for `/world/`, `/national/`, `/international/`, and related category markers.

## Still Included
- Recent emergency filter.
- Article published dates.
- Source links.
- Evidence counts.
- Property parser fix.
