# amfin

## Deployment

This app is now prepared for online hosting in two ways:

- Static frontend: the existing GitHub Pages workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) will publish the site from the repository root.
- Optional backend: the `server/` folder is included for future GitHub sync, but the current `index.html` frontend stores data locally in browser `localStorage` and does not call `/api/data`.

### Required environment variables for the server

Set these in your hosting provider:

- `GITHUB_TOKEN` — a GitHub personal access token with `repo` access
- `GITHUB_OWNER` — repository owner
- `GITHUB_REPO` — repository name
- `GITHUB_BRANCH` — default branch, usually `main`
- `GITHUB_DATA_PATH` — storage file path, usually `data.json`

### Quick deploy to Render

1. Push these changes to GitHub.
2. Create a new Render web service from this repository.
3. Render will use [render.yaml](render.yaml) to install dependencies and start the server.