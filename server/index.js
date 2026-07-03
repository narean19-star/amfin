const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

const envPath = path.resolve(__dirname, '.env');
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
  console.warn(`Warning: could not load server .env from ${envPath}. ${dotenvResult.error.message}`);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_SYNC_ENABLED = process.env.GITHUB_SYNC_ENABLED !== 'false';
const GITHUB_FALLBACK_ENABLED = process.env.GITHUB_FALLBACK_ENABLED !== 'false';
const OWNER = process.env.GITHUB_OWNER || 'narean19-star';
const REPO = process.env.GITHUB_REPO || 'amfin';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DATA_PATH = process.env.GITHUB_DATA_PATH || 'data.json';
const PORT = process.env.PORT || 3000;
const rootDir = path.resolve(__dirname, '..');
const LOCAL_DATA_PATH = path.join(rootDir, DATA_PATH);

if (!GITHUB_TOKEN) {
  console.warn('Warning: GITHUB_TOKEN is not set. Server will still run but GitHub operations will fail.');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(rootDir));

function getDefaultData() {
  return {
    entries: [],
    purchases: [],
    expenses: [],
    cheques: [],
    owners: [],
    customers: [],
    items: [],
    suppliers: [],
    expenseCategories: [],
    lastSaved: new Date().toISOString()
  };
}

async function readLocalData() {
  try {
    const file = await fs.promises.readFile(LOCAL_DATA_PATH, 'utf8');
    return JSON.parse(file);
  } catch (err) {
    return getDefaultData();
  }
}

async function writeLocalData(payload) {
  await fs.promises.writeFile(LOCAL_DATA_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});


app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/data', async (req, res) => {
  const localData = await readLocalData();
  const localTimestamp = localData.lastSaved ? new Date(localData.lastSaved).getTime() : 0;

  if (!GITHUB_TOKEN || !GITHUB_SYNC_ENABLED) {
    return res.json({
      data: localData,
      sha: null,
      storage: 'local',
      cloudAvailable: false,
      details: 'GitHub sync disabled'
    });
  }

  try {
    const response = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: DATA_PATH, ref: BRANCH });
    const content = Buffer.from(response.data.content, 'base64').toString();
    const sha = response.data.sha;
    let cloudData = {};
    try { cloudData = JSON.parse(content); } catch (e) { cloudData = {}; }
    const cloudTimestamp = cloudData.lastSaved ? new Date(cloudData.lastSaved).getTime() : 0;

    if (cloudTimestamp > localTimestamp) {
      return res.json({
        data: cloudData,
        sha,
        storage: 'github',
        cloudAvailable: true,
        details: 'GitHub data is newer'
      });
    }

    return res.json({
      data: localData,
      sha: null,
      storage: 'local',
      cloudAvailable: true,
      details: 'Local data is newer than GitHub'
    });
  } catch (err) {
    if (err.status === 404) {
      return res.json({
        data: localData,
        sha: null,
        storage: 'local',
        cloudAvailable: false,
        details: 'No GitHub data file found'
      });
    }
    console.warn('GET /api/data returning local storage because GitHub read failed', err.message || err);
    return res.json({
      data: localData,
      sha: null,
      storage: 'local',
      cloudAvailable: false,
      details: `GitHub read failed: ${err.message || 'unknown error'}`
    });
  }
});

app.post('/api/data', async (req, res) => {
  const payload = req.body;
  await writeLocalData(payload);

  if (GITHUB_TOKEN && GITHUB_SYNC_ENABLED) {
    try {
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

      return res.json({ ok: true, content: result.data.content, storage: 'github' });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Unknown GitHub error';
      console.warn('GitHub write failed:', message);
      if (!GITHUB_FALLBACK_ENABLED) {
        return res.status(500).json({ ok: false, error: 'Failed to write data to GitHub', details: message });
      }
      return res.json({ ok: true, fallback: true, storage: 'local', details: message });
    }
  }

  return res.json({ ok: true, storage: 'local' });
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
