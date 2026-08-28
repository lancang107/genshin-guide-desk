# 原石筹备 | Genshin planning desk

把有限的游戏时间，换成更确定的抽卡准备。

> 线上地址：<https://genshin-strategy.netlify.app/>
>
> 当前版本：7.0
>
> 状态：MVP，持续维护

## 这个项目是给谁用的

- 给想快速获得原石、但不知道从哪里做起的玩家
- 给刚入坑 / 回坑、想抽到当期 UP 角色的玩家
- 给面对任务、宝箱、神瞳、成就和海量攻略感到茫然又迫切的玩家

## 能帮你解决什么问题

- 卡池时间有限，原石来源很多，不知道先做什么
- 攻略来源太杂，不确定该信谁
- 不知道自己做了哪些任务，状态一团乱
- 养成材料和每周体力安排没有统一视图

## 能做什么 / 有什么能力

- 一次性原石来源整理成可执行清单
- 分清优先完成、值得安排和有余力再做
- 一条龙覆盖大区域探索，避免重复跟视频
- 只看优质 UP 主池里的攻略，不收录池外低质二创
- 成就、宝箱、神瞳、供奉、世界任务集中管理
- 养成计划统一展示天赋、专武、周本、普通 Boss、圣遗物等材料
- 所有进度只保存在当前浏览器，无需注册

## 怎么使用

### 线上访问（推荐）

直接打开：

- <https://genshin-strategy.netlify.app/>

线上地址会随版本更新，当前是 7.0。每次数据更新后推送到 GitHub，由 Netlify 自动发布新版本。

### 本地运行

新手建议直接用线上网址打开，无需安装任何东西。

如果希望本地开发、改数据或查看源码，按下面步骤操作：

1. 安装 Node.js LTS：<https://nodejs.org/>
2. 克隆本项目到本地：

   ```bash
   git clone <你的仓库地址>
   ```

3. 打开终端，进入项目目录。
4. 启动本地服务：

   ```bash
   npm start
   ```

5. 浏览器打开：

   ```text
   http://127.0.0.1:4173/
   ```

需要检查数据是否完整：

```bash
npm run validate
```

## 项目结构

```text
app.js / index.html / styles.css     # 纯前端页面
data/                                # 所有数据
  creators.json                      # 优质 UP 主池
  current.json                       # 当前版本指针
  versions/{version}/                # 版本当期资源
  catalog/                           # 跨版本一次性资源目录
  schema/                            # JSON 数据结构
docs/                                # 方案、来源、部署、版本更新说明
scripts/                             # 数据校验与生产报告脚本
```

## 数据设计

- `data/versions/{version}/`：每个版本的当期原石与养成资源
- `data/catalog/one-time-resources/`：一次性资源目录
- `data/catalog/achievements/`：成就数据
- `data/catalog/source-links.json`：官方 / 米游社核验链接
- `data/creators.json`：优质 UP 主池

## 来源规范

执行攻略只使用 `data/creators.json` 中收录的优质 UP 主；核验来源优先使用官方公告、米游社和游戏内素材；不收录池外低质量或二次加工的攻略视频。

## 版本更新流程

1. 复制 `docs/version-bump-template.md` 作为新版本核对清单。
2. 更新 `data/versions/{version}/` 与 `data/catalog/`。
3. 运行 `npm run validate`。
4. 推送到 GitHub。
5. Netlify 自动发布新版本。

## 后续迭代方向

- 成就单条拆分与任务重叠处理
- 账号记忆功能
- 自动抓取官方与 UP 主视频
- 自定义域名
- 覆盖更多版本和角色

## 声明

非官方项目，与原神 / 米哈游无关；数据用于个人规划与学习，不构成游戏内收益承诺。所有攻略链接仅供学习参考，版权归原作者所有。
