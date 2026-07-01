# PI v0.2.4 PERM-001 Official Mecklenburg Permit Connector

This release adds the first official permit data connector using Mecklenburg County public ArcGIS Building Permits FeatureServer.

## Install
Copy the contents of this package into the PI3 repository root, replace files, commit, push, then run GitHub Actions -> Update Intelligence.

## What to validate
- GitHub Action succeeds.
- Source Health shows Mecklenburg Building Permits ArcGIS.
- Dashboard metrics show Permit Records Retrieved.
- Capital Improvement opportunities appear if qualifying permit records are found inside the configured permit age window.
- Fire opportunities continue to work.

## Commit message
PI PERM-001 official Mecklenburg permit connector
