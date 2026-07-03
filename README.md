# amfin

## Deployment

This app is now prepared for online hosting in two ways:

- Static frontend: the existing GitHub Pages workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) will publish the site from the repository root.
- Optional backend: the `server/` folder is included for GitHub sync. The frontend now supports a separate backend host via `window.CLOUD_API_BASE`, so cloud sync can work even when the static site is hosted on GitHub Pages.

### Required environment variables for the server

Set these in your hosting provider:

- `GITHUB_TOKEN` — a GitHub personal access token with `repo` access
- `GITHUB_OWNER` — repository owner
- `GITHUB_REPO` — repository name
- `GITHUB_BRANCH` — default branch, usually `main`
- `GITHUB_DATA_PATH` — storage file path, usually `data.json`

A starter `data.json` file is already included at the repository root to make the first cloud sync attempt succeed.

If the frontend is hosted separately (for example, on GitHub Pages) and the backend is deployed on Render, set the API base URL before the app script loads in `index.html`:

```html
<script>
  window.CLOUD_API_BASE = 'https://your-backend-service.onrender.com/api'
</script>
```

### Quick deploy to Render

1. Push these changes to GitHub.
2. Create a new Render web service from this repository.
3. Render will use [render.yaml](render.yaml) to install dependencies and start the server.