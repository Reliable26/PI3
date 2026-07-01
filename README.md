# PI — Property Intelligence

PI is a commercial property intelligence platform. It is not a CRM. It uses public-source signals to identify and prioritize commercial prospecting opportunities.

## Install

1. Copy the contents of this release into the root of a public GitHub repository.
2. Commit and push.
3. In GitHub, set Settings > Pages > Source to GitHub Actions.
4. Run Actions > Update Intelligence > Run workflow.
5. Open the GitHub Pages URL.

## First validation target

This release proves the end-to-end pipeline:

- GitHub Actions runs
- Node tests pass
- Google News RSS can be reached
- Fire/commercial signals are filtered
- Opportunities are generated
- Dashboard loads generated data
- Generated data is deployed as a Pages artifact and is not committed back to Git
