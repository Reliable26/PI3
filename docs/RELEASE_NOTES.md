# PI v0.2.3 - Permit Intelligence Preview

## Added
- Permit Intelligence preview module.
- Commercial permit / capital improvement Google News signal queries.
- Permit source connectivity validation for Charlotte and Mecklenburg public permit pages.
- Permit classification for roofing, building envelope, waterproofing, exterior renovation, commercial alteration, tenant improvement, fire repair, water damage, and structural repair.
- Emergency vs Capital Improvement dashboard counts.

## Important Limitation
This release validates permit-intelligence flow and source connectivity. It does not yet scrape Accela permit records directly. Production permit extraction will require a source-specific parser after access validation.

## Fixed / Preserved
- Keeps strict territory filtering.
- Keeps previous dashboard format.
- Keeps publication dates and source links.
- Does not commit generated data back to Git.
