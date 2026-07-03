const express = require('express');
const path = require('path');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'narean19-star';
const REPO = process.env.GITHUB_REPO || 'amfin';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DATA_PATH = process.env.GITHUB_DATA_PATH || 'data.json';
const PORT = process.env.PORT || 3000;

if (!GITHUB_TOKEN) {
  console.warn('Warning: GITHUB_TOKEN is not set. Server will still run but GitHub operations will fail.');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const app = express();
const rootDir = path.resolve(__dirname, '..');

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(rootDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/data', async (req, res) => {
  try {
    const response = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: DATA_PATH, ref: BRANCH });
    const content = Buffer.from(response.data.content, 'base64').toString();
    const sha = response.data.sha;
    let parsed = {};
    try { parsed = JSON.parse(content); } catch (e) { parsed = {}; }
    return res.json({ data: parsed, sha });
  } catch (err) {
    if (err.status === 404) {
      return res.json({ data: { entries: [], owners: [], customers: [], items: [], expenses: [], expenseCategories: [], notifications: [] }, sha: null });
    }
    console.error('GET /api/data error', err);
    return res.status(500).json({ error: 'Failed to fetch data from GitHub' });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const payload = req.body;
    // get existing sha if present
    let sha = null;
    try {
      const existing = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: DATA_PATH, ref: BRANCH });
      sha = existing.data.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    const content = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');
    const message = `Update ledger data - ${new Date().toISOString()}`;

    const result = await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: DATA_PATH,
      message,
      content,
      branch: BRANCH,
      sha: sha || undefined
    });

    return res.json({ ok: true, content: result.data.content });
  } catch (err) {
    console.error('POST /api/data error', err);
    return res.status(500).json({ error: 'Failed to write data to GitHub' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.sendFile(path.join(rootDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
