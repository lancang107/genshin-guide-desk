# 发布与部署

> 更新时间：2026-08-28

本项目是纯静态站点，数据从 `data/**` 的 JSON 文件在浏览器端加载，不需要后端、数据库或环境变量。

## 推荐路线

1. 把当前目录初始化成 Git 仓库并提交。
2. 推送到 GitHub。
3. 在 Vercel 或 Netlify 导入该 GitHub 仓库。
4. 部署设置都用默认的静态站点配置：
   - Framework Preset / Build command：空
   - Publish directory：`/` 或留空
   - Install command：空
5. 发布后拿到公网 URL。

## 本地可执行步骤

```bash
git init
git add .
git commit -m "MVP 发布准备"
```

创建 GitHub 仓库后关联并推送：

```bash
git branch -M main
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git push -u origin main
```

也可以用 GitHub CLI：

```bash
gh auth login
gh repo create <仓库名> --private --source=. --push
```

## Vercel 操作

1. 打开 https://vercel.com/new ，选择刚刚推送的 GitHub 仓库。
2. Import 后保持默认设置，不需要配置构建命令。
3. Deploy，等待完成，复制生成的 `*.vercel.app` 地址。

## Netlify 操作

1. 打开 https://app.netlify.com/start ，选择 GitHub。
2. 选中仓库，Publish directory 留空或填 `/`。
3. Deploy，等待完成，复制生成的 `*.netlify.app` 地址。

## 发布前检查

- `npm run validate` 必须通过。
- 所有攻略来源仍来自 `data/creators.json` 的优质 UP 主池。
- 官方/米游社核验来源仍保留在来源库中。
- 版本数据和一次性资源目录不属于临时草稿。

## 数据更新流程

1. 修改 `data/**` 下的 JSON。
2. 运行 `npm run validate`。
3. 本地打开 `index.html` 或在 `npm start` 下确认 UI。
4. 提交并推送。
5. Vercel/Netlify 会自动触发部署。

## 后续可自动化

- 在 GitHub 仓库加 `.github/workflows/validate.yml`，每次 push 自动跑 `npm run validate`。
- 使用 GitHub Actions 定时触发版本信息抓取脚本。
- 当前没有后端，适合放在 Vercel/Netlify；等需要账号记忆、自动抓取或服务器端存储时再评估云函数或数据库。
