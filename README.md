# PI PERM-001a Official Mecklenburg Permit Connector Fix

This build fixes PERM-001 so it points to Mecklenburg's Accela Building Permits FeatureServer and maps the correct live field names.

## Install
Copy contents into the PI3 repository root, replace files, commit, push, then run GitHub Actions > Update Intelligence.

Commit message:

PI PERM-001a official Mecklenburg Accela permit connector fix

## What to verify
- GitHub Action passes.
- Source Health shows Mecklenburg Building Permits Accela.
- Permit records retrieved is greater than 0.
- Capital Improvement opportunities appear if qualified commercial target permits are present in the latest records.
