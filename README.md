# GitHub Stars Sync

自动同步你的 GitHub Stars 并生成静态页面，部署到 GitHub Pages。

## 功能

- ✅ 每日自动从 GitHub 抓取最新的 stars 列表
- ✅ 保留你手动添加的标签和笔记
- ✅ 生成可搜索、可筛选的静态页面
- ✅ 部署到 GitHub Pages
- ✅ 支持手动触发同步

## 本地使用

```bash
cd stars-sync
npm install
node sync.js
```

生成的文件在 `dist/` 目录。

## 手动编辑标签

编辑 `data/stars-data.json` 文件，为每个仓库添加 `tags` 和 `note` 字段：

```json
{
  "repos": [
    {
      "id": 123456,
      "full_name": "owner/repo",
      "tags": ["AI", "前端", "工具"],
      "note": "这是我常用的工具"
    }
  ]
}
```

## GitHub Actions 自动同步

1. 推送代码到 GitHub
2. 在 repo 设置中启用 GitHub Pages（Source: gh-pages branch）
3. 创建一个 Personal Access Token 并保存为 `GH_TOKEN` secrets
4. 每天早上 8:00（UTC）会自动同步一次

## 手动触发

在 GitHub Actions 页面点击 "Sync Stars Daily" → "Run workflow"

## 预览

https://unkownY.github.io/stars