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
const TEMPLATE_FILE = path.join(__dirname, 'template', 'index.html');

// Ensure directories exist
[path.join(__dirname, 'data'), OUTPUT_DIR, path.join(__dirname, 'template')].forEach(dir => {
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
    if (page >= 10) break;
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
    { patterns: [/docker/i, /kubernetes/i, /k8s/i, /devops/i, /jenkins/i, /github.?action/i, /terraform/i, /ansible/i, /aws/i, /azure/i, /gcp/i, /cloud/i, /container/i, /helm/i], tags: ['DevOps'] },
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

// Generate static HTML using template
function generateSite(data) {
  const repos = [...data.repos, ...(data.customRepos || [])];
  const allTags = [...new Set(repos.flatMap(r => r.tags || []))].sort();
  
  // Read template
  let template = '';
  if (fs.existsSync(TEMPLATE_FILE)) {
    template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');
  } else {
    console.log('Template not found, using inline generation');
    return generateSiteInline(data);
  }
  
  // Check if template has placeholders for data injection
  if (template.includes('{{DATA}}')) {
    template = template.replace('{{DATA}}', JSON.stringify(data));
  }
  
  // Save data file for the page to fetch
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data', 'stars-data.json'), JSON.stringify(data, null, 2));
  
  // Write the index.html
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), template);
  
  console.log(`Generated site with ${repos.length} repos, ${allTags.length} tags`);
}

// Fallback inline generation
function generateSiteInline(data) {
  const repos = [...data.repos, ...(data.customRepos || [])];
  const allTags = [...new Set(repos.flatMap(r => r.tags || []))].sort();
  
  // Sort by stars
  const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
  
  const langColors = {
    'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5',
    'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584', 'Ruby': '#701516',
    'PHP': '#4F5D95', 'C++': '#f34b7d', 'C': '#555555', 'Swift': '#F05138',
    'Kotlin': '#A97BFF', 'Vue': '#41b883', 'CSS': '#563d7c', 'HTML': '#e34c26'
  };
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Stars - ${USERNAME}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d1117; --card-bg: #161b22; --border: #30363d; --text: #e6edf3;
      --text-secondary: #8b949e; --accent: #f0883e; --accent-hover: #db6d28;
      --tag-bg: rgba(56, 139, 253, 0.15); --tag-text: #58a6ff;
      --success: #3fb950; --danger: #f85149; --input-bg: #0d1117;
    }
    html, body { height: 100%; font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    #app { min-height: 100vh; display: flex; flex-direction: column; }
    a { color: var(--tag-text); text-decoration: none; }
    a:hover { text-decoration: underline; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-secondary); }

    .header { position: sticky; top: 0; z-index: 100; background: var(--card-bg); border-bottom: 1px solid var(--border); }
    .header-content { max-width: 1400px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; gap: 24px; }
    .logo { display: flex; align-items: center; gap: 10px; color: var(--accent); }
    .logo h1 { font-size: 20px; font-weight: 600; color: var(--text); }
    .search-box { flex: 1; max-width: 480px; position: relative; }
    .search-box input { width: 100%; padding: 10px 36px 10px 42px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px; }
    .search-box input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(240, 136, 62, 0.15); }
    .search-box input::placeholder { color: var(--text-secondary); }
    .clear-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--text-secondary); cursor: pointer; display: none; }
    .clear-btn:hover { color: var(--text); }
    .actions { display: flex; gap: 12px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; border: none; transition: all 0.2s; cursor: pointer; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--border); }

    .main { flex: 1; max-width: 1400px; margin: 0 auto; padding: 24px; width: 100%; }
    .stats { display: flex; align-items: center; gap: 24px; margin-bottom: 24px; padding: 16px 20px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); }
    .stat-item { display: flex; align-items: baseline; gap: 6px; }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--accent); }
    .stat-label { color: var(--text-secondary); font-size: 14px; }
    .stat-divider { width: 1px; height: 32px; background: var(--border); }
    .filter-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filter-label { color: var(--text-secondary); font-size: 14px; }
    .tags-filter { display: flex; gap: 8px; flex-wrap: wrap; }
    .tag-btn { padding: 4px 12px; border-radius: 16px; font-size: 12px; background: var(--input-bg); border: 1px solid var(--border); color: var(--text-secondary); transition: all 0.2s; cursor: pointer; }
    .tag-btn:hover { border-color: var(--tag-text); color: var(--tag-text); }
    .tag-btn.active { background: var(--tag-bg); border-color: var(--tag-text); color: var(--tag-text); }
    .clear-filter { padding: 4px 12px; border-radius: 16px; font-size: 12px; background: transparent; border: none; color: var(--danger); cursor: pointer; }
    .clear-filter:hover { text-decoration: underline; }

    .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 16px; color: var(--text-secondary); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-message { text-align: center; padding: 40px 20px; color: var(--danger); }
    .repos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
    .empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; color: var(--text-secondary); }
    .empty-state svg { opacity: 0.5; }

    .repo-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; transition: border-color 0.2s, box-shadow 0.2s; }
    .repo-card:hover { border-color: var(--text-secondary); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); }
    .card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .repo-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 8px; color: var(--text-secondary); flex-shrink: 0; }
    .repo-meta { flex: 1; min-width: 0; }
    .repo-name-link { display: block; font-weight: 600; font-size: 15px; color: var(--tag-text); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .repo-name-link:hover { text-decoration: underline; }
    .repo-stats { display: flex; align-items: center; gap: 12px; margin-top: 4px; font-size: 12px; color: var(--text-secondary); }
    .stars { display: flex; align-items: center; gap: 4px; }
    .stars svg { color: var(--accent); }
    .language { display: flex; align-items: center; gap: 4px; }
    .lang-dot { width: 10px; height: 10px; border-radius: 50%; }
    .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .action-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 6px; background: transparent; color: var(--text-secondary); cursor: pointer; transition: background 0.2s, color 0.2s; }
    .action-btn:hover { background: var(--bg); color: var(--text); }
    .action-btn.delete:hover { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
    .repo-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .repo-desc.empty { color: var(--border); font-style: italic; }
    .card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .tag { padding: 4px 10px; border-radius: 12px; font-size: 12px; background: var(--tag-bg); color: var(--tag-text); }
    .card-note { background: var(--bg); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .note-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
    .note-text { font-size: 13px; color: var(--text); line-height: 1.5; white-space: pre-wrap; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); }
    .modal-header h2 { font-size: 18px; font-weight: 600; }
    .close-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: none; background: transparent; color: var(--text-secondary); font-size: 24px; cursor: pointer; }
    .close-btn:hover { background: var(--border); color: var(--text); }
    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-group label { font-size: 14px; font-weight: 500; color: var(--text-secondary); }
    .form-group input, .form-group textarea { padding: 12px 14px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: var(--accent); }
    .form-group textarea { resize: vertical; min-height: 100px; }
    .repo-info { padding: 12px 14px; background: var(--input-bg); border-radius: 8px; }
    .repo-info .repo-name { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--tag-text); }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 20px 24px; border-top: 1px solid var(--border); }

    @media (max-width: 768px) {
      .header-content { flex-wrap: wrap; gap: 16px; }
      .search-box { order: 3; flex-basis: 100%; }
      .stats { flex-wrap: wrap; }
      .repos-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="app">
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <h1>My Stars</h1>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="搜索仓库名称、描述、标签...">
          <span id="clearBtn" class="clear-btn" style="display:none;">×</span>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" id="refreshBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            刷新
          </button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="stats">
        <div class="stat-item">
          <span class="stat-value" id="repoCount">${repos.length}</span>
          <span class="stat-label">个仓库</span>
        </div>
        <div class="stat-item">
          <span class="stat-value" id="tagCount">${allTags.length}</span>
          <span class="stat-label">个标签</span>
        </div>
        <div class="stat-divider"></div>
        <div class="filter-group">
          <span class="filter-label">筛选标签：</span>
          <div class="tags-filter" id="tagsFilter"></div>
          <button id="clearFilter" class="clear-filter" style="display:none;">清除筛选</button>
        </div>
      </div>

      <div id="loading" class="loading" style="display:none;">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div id="error" class="error-message" style="display:none;"></div>

      <div id="reposGrid" class="repos-grid"></div>
      
      <div id="emptyState" class="empty-state" style="display:none;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>没有匹配的仓库</p>
      </div>
    </main>

    <!-- Edit Modal -->
    <div id="editModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>编辑仓库信息</h2>
          <button class="close-btn" id="closeEditModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>仓库</label>
            <div class="repo-info">
              <span class="repo-name" id="editRepoName"></span>
            </div>
          </div>
          <div class="form-group">
            <label>标签（用逗号分隔）</label>
            <input type="text" id="editTags" placeholder="例如: 前端, Vue, 工具">
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea id="editNote" placeholder="写下你对这个仓库的备注..." rows="4"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelEdit">取消</button>
          <button class="btn btn-primary" id="saveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const DATA_FILE = './data/stars-data.json';
    let repos = [];
    let allTags = [];
    let selectedTags = [];
    let currentEditingRepo = null;

    async function loadData() {
      try {
        const response = await fetch(DATA_FILE);
        const data = await response.json();
        repos = [...(data.repos || []), ...(data.customRepos || [])];
        allTags = [...new Set(repos.flatMap(r => r.tags || []))].sort();
        render();
      } catch (e) {
        document.getElementById('error').textContent = '加载数据失败';
        document.getElementById('error').style.display = 'block';
      }
    }

    function render() {
      document.getElementById('repoCount').textContent = repos.length;
      document.getElementById('tagCount').textContent = allTags.length;
      
      const filterDiv = document.getElementById('tagsFilter');
      filterDiv.innerHTML = '';
      allTags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'tag-btn' + (selectedTags.includes(tag) ? ' active' : '');
        btn.textContent = tag;
        btn.onclick = () => toggleTag(tag);
        filterDiv.appendChild(btn);
      });
      
      document.getElementById('clearFilter').style.display = selectedTags.length ? 'inline-flex' : 'none';
      
      const search = document.getElementById('searchInput').value.toLowerCase();
      const filtered = repos.filter(r => {
        const matchSearch = !search || 
          r.full_name.toLowerCase().includes(search) ||
          (r.description || '').toLowerCase().includes(search) ||
          (r.tags || []).some(t => t.toLowerCase().includes(search)) ||
          (r.note || '').toLowerCase().includes(search);
        const matchTags = selectedTags.length === 0 || selectedTags.every(t => (r.tags || []).includes(t));
        return matchSearch && matchTags;
      }).sort((a, b) => b.stargazers_count - a.stargazers_count);
      
      const langColors = {'JavaScript':'#f1e05a','TypeScript':'#3178c6','Python':'#3572A5','Java':'#b07219','Go':'#00ADD8','Rust':'#dea584'};
      
      const grid = document.getElementById('reposGrid');
      grid.innerHTML = filtered.map(r => \`
        <div class="repo-card">
          <div class="card-header">
            <div class="repo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/></svg>
            </div>
            <div class="repo-meta">
              <a href="\${r.html_url}" class="repo-name-link" target="_blank">\${r.full_name}</a>
              <div class="repo-stats">
                \${r.stargazers_count ? \`<span class="stars"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>\${r.stargazers_count >= 1000 ? (r.stargazers_count/1000).toFixed(1)+'k' : r.stargazers_count}</span>\` : ''}
                \${r.language ? \`<span class="language"><span class="lang-dot" style="background:\${langColors[r.language]||'#8b949e'}"></span>\${r.language}</span>\` : ''}
              </div>
            </div>
            <div class="card-actions">
              <button class="action-btn" onclick="editRepo('\${r.full_name.replace(/'/g, \"\\\\'\")}')" title="编辑">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          </div>
          \${r.description ? \`<p class="repo-desc">\${r.description}</p>\` : '<p class="repo-desc empty">暂无描述</p>'}
          \${r.tags?.length ? \`<div class="card-tags">\${r.tags.map(t => \`<span class="tag">\${t}</span>\`).join('')}</div>\` : ''}
          \${r.note ? \`<div class="card-note"><div class="note-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>备注</div><p class="note-text">\${r.note}</p></div>\` : ''}
        </div>
      \`).join('');
      
      document.getElementById('emptyState').style.display = filtered.length ? 'none' : 'flex';
    }

    function toggleTag(tag) {
      const idx = selectedTags.indexOf(tag);
      if (idx > -1) selectedTags.splice(idx, 1);
      else selectedTags.push(tag);
      render();
    }

    function editRepo(fullName) {
      currentEditingRepo = repos.find(r => r.full_name === fullName);
      if (!currentEditingRepo) return;
      document.getElementById('editRepoName').textContent = currentEditingRepo.full_name;
      document.getElementById('editTags').value = (currentEditingRepo.tags || []).join(', ');
      document.getElementById('editNote').value = currentEditingRepo.note || '';
      document.getElementById('editModal').style.display = 'flex';
    }

    function saveEdit() {
      if (!currentEditingRepo) return;
      const tags = document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(Boolean);
      const note = document.getElementById('editNote').value;
      currentEditingRepo.tags = tags;
      currentEditingRepo.note = note;
      localStorage.setItem('repo-' + currentEditingRepo.id, JSON.stringify({ tags, note }));
      document.getElementById('editModal').style.display = 'none';
      render();
    }

    document.getElementById('searchInput').addEventListener('input', () => {
      document.getElementById('clearBtn').style.display = document.getElementById('searchInput').value ? 'inline' : 'none';
      render();
    });
    document.getElementById('clearBtn').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('clearBtn').style.display = 'none';
      render();
    });
    document.getElementById('closeEditModal').addEventListener('click', () => document.getElementById('editModal').style.display = 'none');
    document.getElementById('cancelEdit').addEventListener('click', () => document.getElementById('editModal').style.display = 'none');
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    document.getElementById('clearFilter').addEventListener('click', () => { selectedTags = []; render(); });
    document.getElementById('refreshBtn').addEventListener('click', () => location.reload());

    loadData();
  </script>
</body>
</html>`;

  // Ensure data directory exists
  if (!fs.existsSync(path.join(OUTPUT_DIR, 'data'))) {
    fs.mkdirSync(path.join(OUTPUT_DIR, 'data'), { recursive: true });
  }
  
  // Save data file
  fs.writeFileSync(path.join(OUTPUT_DIR, 'data', 'stars-data.json'), JSON.stringify(data, null, 2));
  
  // Write HTML
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), html);
  
  console.log(`Generated site with ${repos.length} repos`);
}

// Main sync function
async function sync() {
  console.log('Starting stars sync...');
  
  try {
    console.log('Fetching stars from GitHub...');
    const freshRepos = await fetchAllStars(USERNAME);
    
    const existingData = loadExistingData();
    const existingMap = new Map(existingData.repos.map(r => [r.id, r]));
    
    const mergedRepos = freshRepos.map(r => {
      const existing = existingMap.get(r.id);
      if (existing) {
        return {
          ...r,
          tags: existing.tags?.length ? existing.tags : r.tags || [],
          note: existing.note || ''
        };
      }
      const tags = autoTag(r);
      return { ...r, tags, note: '' };
    });
    
    const newData = {
      repos: mergedRepos,
      customRepos: existingData.customRepos || [],
      lastUpdated: new Date().toISOString()
    };
    saveData(newData);
    generateSite(newData);
    
    console.log('Sync completed!');
    return { success: true, reposCount: mergedRepos.length };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  sync().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { sync, fetchAllStars };