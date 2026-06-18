# AM Sales - Server-side GitHub Sync

This server provides a secure endpoint for the frontend to read/write `data.json` in your GitHub repository without embedding a Personal Access Token in the client.

## Setup

1. Copy `.env.example` to `.env` and set `GITHUB_TOKEN` to a Personal Access Token with `repo` scope.

2. Install dependencies and start the server:

```bash
cd server
npm install
npm start
```

3. By default the server listens on port `3000`. The frontend expects the server on the same origin (`/api/data`). If you serve the frontend separately, configure a reverse proxy or set CORS appropriately.

## Endpoints

- `GET /api/data` — returns `{ data, sha }` for the repository file (creates default if missing)
- `POST /api/data` — accepts JSON body and writes to `data.json` in the repo using the server-side token

## Rotate Token

To rotate the GitHub token safely:

1. Create a new PAT in GitHub with `repo` scope.
2. Update the `.env` file with the new `GITHUB_TOKEN` value.
3. Restart the server: `npm restart` (or stop and `npm start`).
4. Revoke the old token in GitHub: https://github.com/settings/tokens

**Do not commit your `.env` file to the repository.**
