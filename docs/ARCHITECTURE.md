# Architecture

PI uses GitHub Actions to generate static JSON data during deployment. Generated data is deployed to GitHub Pages but is not committed back to Git.

Current pipeline:
Google News RSS -> Classifier -> Recency Filter -> Grouping -> Opportunity Builder -> Static Dashboard
