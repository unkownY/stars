#!/usr/bin/env node
/**
 * Auto-tag repos based on patterns
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'stars-data.json');

// Auto-tagging rules
const tagRules = [
  // AI/ML patterns
  { patterns: [/ai/i, /llm/i, /gpt/i, /chat/i, /agent/i, /gen/i, /model/i, /neural/i, /transformer/i, /diffusion/i, /stable.?diffusion/i, /openai/i, /claude/i, /gemini/i, /llama/i], tags: ['AI'] },
  
  // Mavis/Agent Skills
  { patterns: [/skill/i, /mavis/i, /agent/i, /prompt/i, /llm/i], tags: ['Agent', 'Mavis技能'] },
  
  // Frontend patterns
  { patterns: [/vue/i, /react/i, /angular/i, /svelte/i, /next/i, /nuxt/i, /tailwind/i, /css/i, /html/i, /front/i, /ui/i, /component/i, /webpack/i, /vite/i], tags: ['前端'] },
  
  // Backend patterns  
  { patterns: [/node/i, /express/i, /koa/i, /nest/i, /django/i, /flask/i, /fastapi/i, /rails/i, /laravel/i, /spring/i, /go/i, /rust/i, /deno/i, /bun/i], tags: ['后端'] },
  
  // DevOps patterns
  { patterns: [/docker/i, /kubernetes/i, /k8s/i, /devops/i, /ci\/cd/i, /jenkins/i, /github.?action/i, /terraform/i, /ansible/i, /aws/i, /azure/i, /gcp/i, /cloud/i, /container/i, /helm/i, /docker/i], tags: ['DevOps'] },
  
  // Tools patterns
  { patterns: [/cli/i, /tool/i, /utility/i, /helper/i, /wrapper/i, /script/i, /command/i, /bash/i, /shell/i, /terminal/i], tags: ['工具'] },
  
  // Database patterns
  { patterns: [/database/i, /db/i, /sql/i, /mysql/i, /postgres/i, /mongo/i, /redis/i, /elasticsearch/i, /kafka/i, /cassandra/i, /sqlite/i], tags: ['数据库'] },
  
  // Python patterns
  { patterns: [/python/i, /pypi/i, /pip/i], tags: ['Python'] },
  
  // JavaScript/TypeScript patterns
  { patterns: [/javascript/i, /typescript/i, /js/i, /ts/i, /npm/i, /yarn/i, /pnpm/i, /node\.?js/i], tags: ['JavaScript'] },
  
  // Rust patterns
  { patterns: [/rust/i], tags: ['Rust'] },
  
  // Go patterns
  { patterns: [/golang/i, /go\s/i], tags: ['Go'] },
  
  // macOS
  { patterns: [/macos/i, /mac\s/i, /darwin/i], tags: ['macOS'] },
  
  // Games
  { patterns: [/game/i, /engine/i, /unity/i, /unreal/i, /godot/i, /gaming/i, /play/i], tags: ['游戏'] },
  
  // Learning
  { patterns: [/learn/i, /tutorial/i, /course/i, /guide/i, /example/i, /demo/i, /docs/i, /document/i], tags: ['学习'] },
  
  // Open Source
  { patterns: [/open.?source/i, /open.?core/i, /oss/i], tags: ['开源'] },
  
  // APIs
  { patterns: [/api/i, /rest/i, /graphql/i, /grpc/i, /endpoint/i, /swagger/i], tags: ['API'] },
  
  // Security
  { patterns: [/security/i, /auth/i, /oauth/i, /jwt/i, /crypto/i, /encrypt/i, /vpn/i, /proxy/i, /firewall/i], tags: ['安全'] },
  
  // Mobile
  { patterns: [/mobile/i, /ios/i, /android/i, /react.?native/i, /flutter/i, /swift/i, /kotlin/i], tags: ['移动'] },
  
  // Desktop
  { patterns: [/desktop/i, /electron/i, /tauri/i, /nwjs/i, /app/i], tags: ['桌面'] },
  
  // Low-code/No-code
  { patterns: [/low.?code/i, /no.?code/i, /cms/i, /headless/i], tags: ['低代码'] },
  
  // Monitoring
  { patterns: [/monitor/i, /metric/i, /log/i, /trace/i, /alert/i, /prometheus/i, /grafana/i], tags: ['监控'] },
  
  // Productivity
  { patterns: [/productivity/i, /boilerplate/i, /starter/i, /template/i, /scaffold/i], tags: ['效率'] },
  
  // Media/Design
  { patterns: [/image/i, /video/i, /audio/i, /photo/i, /graphic/i, /design/i, /icon/i, /font/i, /emoji/i], tags: ['设计'] },
  
  // Data/ML
  { patterns: [/data/i, /ml/i, /deep.?learn/i, /tensor/i, /pytorch/i, /keras/i, /scikit/i, /pandas/i, /numpy/i], tags: ['数据'] },
  
  // Scripts
  { patterns: [/shell/i, /bash/i, /zsh/i, /fish/i, /script/i], tags: ['脚本'] },
  
  // Config
  { patterns: [/config/i, /dotfile/i, /setup/i, /install/i], tags: ['配置'] }
];

function autoTag(repo) {
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

// Load data
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

// Tag all repos
let taggedCount = 0;
data.repos = data.repos.map(repo => {
  const tags = autoTag(repo);
  if (tags.length > 0) {
    taggedCount++;
    return { ...repo, tags };
  }
  return repo;
});

console.log(`Tagged ${taggedCount} repos out of ${data.repos.length}`);

// Save
fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('Data saved!');