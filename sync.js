#!/usr/bin/env node
/**
 * GitHub Stars Sync Script
 * - Fetches latest stars from GitHub
 * - Preserves user-added tags and notes
 * - Generates static site for GitHub Pages
 * - Can be run manually or via cron
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const USERNAME = 'unkownY';
const REPO_NAME = 'stars';
const DATA_FILE = path.join(__dirname, 'data', 'stars-data.json');
const OUTPUT_DIR = path.join(__dirname, 'dist');

// Ensure directories exist
[path.join(__dirname, 'data'), OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Fetch GitHub API
function fetchGitHub(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      headers: {
        'User-Agent': 'Stars-Sync-Script',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fetch all starred repos
async function fetchAllStars(username) {
  const allRepos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    console.log(`Fetching page ${page}...`);
    const repos = await fetchGitHub(`/users/${username}/starred?per_page=${perPage}&page=${page}`);
    
    if (!Array.isArray(repos) || repos.length === 0) break;
    
    allRepos.push(...repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      html_url: r.html_url,
      stargazers_count: r.stargazers_count,
      language: r.language,
      topics: r.topics || []
    })));
    
    if (repos.length < perPage) break;
    if (page >= 10) break; // Safety limit
    page++;
  }

  return allRepos;
}

// Load existing data (preserves user modifications)
function loadExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading existing data:', e.message);
  }
  return { repos: [], customRepos: [], lastUpdated: null };
}

// Save data
function saveData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved ${data.repos.length} repos to ${DATA_FILE}`);
}

// Auto-tagging function
function autoTag(repo) {
  const tagRules = [
    { patterns: [/ai/i, /llm/i, /gpt/i, /chat/i, /agent/i, /gen/i, /model/i, /neural/i, /transformer/i], tags: ['AI'] },
    { patterns: [/skill/i, /mavis/i, /prompt/i], tags: ['Agent', 'Mavis技能'] },
    { patterns: [/vue/i, /react/i, /angular/i, /svelte/i, /next/i, /nuxt/i, /tailwind/i, /css/i, /html/i, /front/i, /ui/i, /component/i, /webpack/i, /vite/i], tags: ['前端'] },
    { patterns: [/node/i, /express/i, /koa/i, /nest/i, /django/i, /flask/i, /fastapi/i, /rails/i, /laravel/i, /spring/i, /go/i, /rust/i, /deno/i, /bun/i], tags: ['后端'] },
    { patterns: [/docker/i, /kubernetes/i, /k8s/i, /devops/i, /ci.c d/i, /jenkins/i, /github.?action/i, /terraform/i, /ansible/i, /aws/i, /azure/i, /gcp/i, /cloud/i, /container/i, /helm/i], tags: ['DevOps'] },
    { patterns: [/cli/i, /tool/i, /utility/i, /helper/i, /wrapper/i, /script/i, /command/i, /bash/i, /shell/i, /terminal/i], tags: ['工具'] },
    { patterns: [/database/i, /db/i, /sql/i, /mysql/i, /postgres/i, /mongo/i, /redis/i, /elasticsearch/i, /kafka/i, /cassandra/i, /sqlite/i], tags: ['数据库'] },
    { patterns: [/python/i, /pypi/i, /pip/i], tags: ['Python'] },
    { patterns: [/javascript/i, /typescript/i, /js/i, /ts/i, /npm/i, /yarn/i, /pnpm/i, /node.?js/i], tags: ['JavaScript'] },
    { patterns: [/rust/i], tags: ['Rust'] },
    { patterns: [/golang/i, /go\s/i], tags: ['Go'] },
    { patterns: [/macos/i, /mac\s/i, /darwin/i], tags: ['macOS'] },
    { patterns: [/game/i, /engine/i, /unity/i, /unreal/i, /godot/i, /gaming/i, /play/i], tags: ['游戏'] },
    { patterns: [/learn/i, /tutorial/i, /course/i, /guide/i, /example/i, /demo/i, /docs/i, /document/i], tags: ['学习'] },
    { patterns: [/open.?source/i, /open.?core/i, /oss/i], tags: ['开源'] },
    { patterns: [/api/i, /rest/i, /graphql/i, /grpc/i, /endpoint/i, /swagger/i], tags: ['API'] },
    { patterns: [/security/i, /auth/i, /oauth/i, /jwt/i, /crypto/i, /encrypt/i, /vpn/i, /proxy/i, /firewall/i], tags: ['安全'] },
    { patterns: [/mobile/i, /ios/i, /android/i, /react.?native/i, /flutter/i, /swift/i, /kotlin/i], tags: ['移动'] },
    { patterns: [/desktop/i, /electron/i, /tauri/i, /nwjs/i, /app/i], tags: ['桌面'] },
    { patterns: [/low.?code/i, /no.?code/i, /cms/i, /headless/i], tags: ['低代码'] },
    { patterns: [/monitor/i, /metric/i, /log/i, /trace/i, /alert/i, /prometheus/i, /grafana/i], tags: ['监控'] },
    { patterns: [/productivity/i, /boilerplate/i, /starter/i, /template/i, /scaffold/i], tags: ['效率'] },
    { patterns: [/image/i, /video/i, /audio/i, /photo/i, /graphic/i, /design/i, /icon/i, /font/i, /emoji/i], tags: ['设计'] },
    { patterns: [/data/i, /ml/i, /deep.?learn/i, /tensor/i, /pytorch/i, /keras/i, /scikit/i, /pandas/i, /numpy/i], tags: ['数据'] },
    { patterns: [/shell/i, /bash/i, /zsh/i, /fish/i, /script/i], tags: ['脚本'] },
    { patterns: [/config/i, /dotfile/i, /setup/i, /install/i], tags: ['配置'] }
  ];
  
  const combined = `${repo.full_name} ${repo.description || ''} ${(repo.topics || []).join(' ')} ${repo.language || ''}`.toLowerCase();
  const tags = new Set();
  
  for (const rule of tagRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(combined)) {
        rule.tags.forEach(t => tags.add(t));
        break;
      }
    }
  }
  
  return Array.from(tags);
}

// Generate static HTML
function generateSite(data) {
  const repos = [...data.repos, ...(data.customRepos || [])];
  
  // Group by first tag or "untagged"
  const tagged = repos.filter(r => r.tags?.length);
  const untagged = repos.filter(r => !r.tags?.length);
  
  // Sort by stars
  tagged.sort((a, b) => b.stargazers_count - a.stargazers_count);
  untagged.sort((a, b) => b.stargazers_count - a.stargazers_count);
  
  const allTags = [...new Set(tagged.flatMap(r => r.tags || []))].sort();
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Stars - ${USERNAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-secondary: #8b949e;
      --accent: #f0883e;
      --tag-bg: rgba(56, 139, 253, 0.15);
      --tag-text: #58a6ff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    h1 { font-size: 28px; display: flex; align-items: center; gap: 10px; }
    .star-icon { color: var(--accent); }
    .stats {
      display: flex;
      gap: 20px;
      padding: 16px 20px;
      background: var(--card-bg);
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .stat { font-size: 14px; }
    .stat strong { font-size: 20px; color: var(--accent); }
    .filter-bar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .tag-filter {
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }
    .tag-filter:hover, .tag-filter.active {
      background: var(--tag-bg);
      border-color: var(--tag-text);
      color: var(--tag-text);
    }
    .search-box {
      width: 100%;
      padding: 12px 16px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 14px;
      margin-bottom: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: var(--text-secondary); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .repo-name {
      font-weight: 600;
      color: var(--tag-text);
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
    }
    .repo-name:hover { text-decoration: underline; }
    .stars { font-size: 12px; color: var(--text-secondary); }
    .stars svg { color: var(--accent); }
    .desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .tag {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      background: var(--tag-bg);
      color: var(--tag-text);
    }
    .note {
      background: var(--bg);
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      color: var(--text);
      white-space: pre-wrap;
    }
    .note-label { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
    .updated { text-align: center; color: var(--text-secondary); font-size: 12px; padding: 20px; }
    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
      header { flex-direction: column; gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span class="star-icon">★</span> My Stars</h1>
      <div class="stats">
        <span class="stat"><strong>${repos.length}</strong> repos</span>
        <span class="stat"><strong>${allTags.length}</strong> tags</span>
      </div>
    </header>
    
    <input type="text" class="search-box" placeholder="搜索仓库名称、描述、标签..." id="search" oninput="filterRepos()">
    
    <div class="filter-bar">
      <button class="tag-filter active" onclick="setFilter('')">全部</button>
      ${allTags.map(t => `<button class="tag-filter" onclick="setFilter('${t}')">${t}</button>`).join('')}
    </div>
    
    <div class="grid" id="grid">
      ${[...tagged, ...untagged].map(r => `
        <div class="card" data-name="${r.full_name.toLowerCase()}" data-tags="${(r.tags || []).join(',')}" data-desc="${(r.description || '').toLowerCase()}">
          <div class="card-header">
            <a href="${r.html_url}" class="repo-name" target="_blank">${r.full_name}</a>
            ${r.stargazers_count ? `<span class="stars">★ ${r.stargazers_count >= 1000 ? (r.stargazers_count/1000).toFixed(1)+'k' : r.stargazers_count}</span>` : ''}
          </div>
          ${r.description ? `<p class="desc">${r.description}</p>` : ''}
          ${r.tags?.length ? `<div class="tags">${r.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
          ${r.note ? `<div class="note"><div class="note-label">笔记</div>${r.note}</div>` : ''}
        </div>
      `).join('')}
    </div>
    
    <div class="updated">
      最后更新: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString('zh-CN') : '未知'}
    </div>
  </div>
  
  <script>
    let currentFilter = '';
    function setFilter(tag) {
      currentFilter = tag;
      document.querySelectorAll('.tag-filter').forEach(b => b.classList.toggle('active', b.textContent === (tag || '全部')));
      filterRepos();
    }
    function filterRepos() {
      const query = document.getElementById('search').value.toLowerCase();
      document.querySelectorAll('.card').forEach(card => {
        const matchTag = !currentFilter || card.dataset.tags.includes(currentFilter);
        const matchSearch = !query || card.dataset.name.includes(query) || card.dataset.desc.includes(query);
        card.style.display = matchTag && matchSearch ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
  console.log(`Generated site with ${repos.length} repos`);
}

// Main sync function
async function sync() {
  console.log('Starting stars sync...');
  
  try {
    // 1. Fetch latest stars from GitHub
    console.log('Fetching stars from GitHub...');
    const freshRepos = await fetchAllStars(USERNAME);
    
    // 2. Load existing data (preserves user modifications)
    const existingData = loadExistingData();
    
    // 3. Merge: update existing repos, add new ones
    const existingMap = new Map(existingData.repos.map(r => [r.id, r]));
    
    const mergedRepos = freshRepos.map(r => {
      const existing = existingMap.get(r.id);
      if (existing) {
        // Preserve user's tags and notes
        return {
          ...r,
          tags: existing.tags?.length ? existing.tags : r.tags || [],
          note: existing.note || ''
        };
      }
      // New repo - try to auto-tag
      const tags = autoTag(r);
      return {
        ...r,
        tags,
        note: ''
      };
    });
    
    // 4. Save updated data
    const newData = {
      repos: mergedRepos,
      customRepos: existingData.customRepos || [],
      lastUpdated: new Date().toISOString()
    };
    saveData(newData);
    
    // 5. Generate static site
    generateSite(newData);
    
    console.log('Sync completed!');
    return { success: true, reposCount: mergedRepos.length };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}

// CLI interface
if (require.main === module) {
  sync().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { sync, fetchAllStars };