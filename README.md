# PI - Property Intelligence

PI is a commercial property intelligence platform designed to identify actionable commercial prospecting opportunities from public sources.

## Install
1. Copy the contents of this package into the root of a public GitHub repository.
2. Commit and push.
3. In GitHub, open Settings -> Pages.
4. Set Source to GitHub Actions.
5. Open Actions -> Update Intelligence -> Run workflow.
6. Open the Pages URL after deployment completes.

## Test
After deployment, the dashboard should show:
- Source Health
- Today's Top Opportunities
- Opportunity Feed

If no opportunities appear, check Source Health first. The connector may have retrieved zero commercial fire signals in the latest run.

## Development Rule
Generated data belongs to GitHub Actions deployment output, not Git commits.
