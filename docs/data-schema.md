# 数据 Schema 说明文档

> 本文档说明项目数据层的结构、字段含义和使用方式。

## 目录结构

```
data/
├── schema/                              # JSON Schema 校验文件
│   ├── version-meta.schema.json         # 版本元数据
│   ├── primogems-source.schema.json     # 原石来源
│   ├── character-materials.schema.json  # 角色养成材料
│   ├── guide-package.schema.json        # 攻略套餐
│   ├── creator.schema.json              # UP 主
│   ├── one-time-resource.schema.json    # 永久一次性资源目录
│   └── user-resource-progress.schema.json # 用户资源进度
├── versions/
│   └── {version}/                       # 如 5.2/
│       ├── meta.json                    # 该版本的卡池信息
│       ├── primogems.json               # 该版本所有原石来源
│       ├── packages/                    # 攻略套餐
│       │   ├── new-player-big-pity.json
│       │   ├── new-player-max.json
│       │   ├── returning-big-pity.json
│       │   └── returning-max.json
│       └── characters/                  # 当期 UP 角色养成数据
│           └── {character}/
│               ├── materials.json       # 完整材料清单
│               └── rotation.json        # 日轮换采集计划
├── current.json                         # 当前激活版本指针
└── creators.json                        # UP 主池
```

## 核心数据流

```
current.json (版本指针)
    → versions/{version}/meta.json (卡池角色 + 日期)
    → versions/{version}/primogems.json (当期原石/祈愿道具来源)
    → versions/{version}/packages/{package}.json (套餐 = 资源池 + 排序策略 + 材料计划)
        → resourcePool[].sourceId 引用 primogems.json 中的来源
        → materialPlan.characterIds 引用 characters/{name}/
    → versions/{version}/characters/{name}/materials.json (养成材料清单)

data/catalog/one-time-resources/ (跨版本永久资源目录)
    → 用户进度（localStorage，后续为账号数据库）
    → 根据前置、时间和性价比生成动态套餐
```

## 各 Schema 说明

### 1. version-meta.schema.json

定义版本的卡池结构。一个版本通常有 2 个 phase（上下半卡池），每个 phase 含角色、武器、起止日期。

关键字段：
- `version`: 版本号，如 "5.2"
- `phases[]`: 卡池阶段数组
  - `phase`: 1 或 2
  - `characters[]`: 当期 UP 角色（含元素、武器类型、限定/常驻标记）
  - `weaponBanner[]`: 武器池
  - `durationDays`: 卡池天数（约 21 天）

### 2. primogems-source.schema.json

定义单个原石来源。一个版本的 `primogems.json` 是一个此类型的数组。

关键字段：
- `category`: `one-time`（一次性）/ `recurring`（周期性）/ `limited-time`（限时）
- `subcategory`: 具体类型（archon-quest, event, daily-commission 等，共 15 种）
- `amount`: 兼容旧数据的展示字段
- `rewards`: 原石、纠缠之缘、相遇之缘分开记录，禁止将祈愿道具混入原石总数
- `verification`: `confirmed` / `estimated` / `pending`，决定该数字能否计入保证资源
- `estimatedMinutes`: 预计耗时（0 = 被动来源如维护补偿）
- `difficulty`: easy / medium / hard / passive
- `guideLinks[]`: 攻略链接（平台、URL、标题、UP 主、BV号、时间戳）

### 3. character-materials.schema.json

定义单个角色的完整养成材料清单。

关键字段：
- `character`: 角色基本信息（名称、元素、武器类型、稀有度）
- `ascension`: 突破材料
  - `localSpecialty`: 地区特产（名称、数量、采集地点、刷新时间）
  - `normalBoss`: 普通 BOSS（名称、掉落物、数量、树脂消耗）
  - `elementalStone`: 元素石系列（名称、数量、获取来源）
  - `commonEnemy`: 普通敌人掉落物
- `talents[]`: 天赋材料（每个天赋一本/周本/敌人掉落）
  - `book`: 天赋书（名称、数量、可用日、秘境名、树脂消耗）
  - `weeklyBoss`: 周本（名称、掉落物、数量、树脂消耗）
- `weapon`: 武器突破材料（秘境材料和普通敌人掉落；不消耗周本材料）
- `misc`: 通用材料
  - `expBooks`: 经验书（数量、树脂消耗）
  - `mora`: 摩拉（数量、树脂消耗）
  - `artifactDomain`: 圣遗物秘境推荐

### 4. guide-package.schema.json

定义攻略套餐，是连接原石任务和养成计划的核心结构。

关键字段：
- `audience`: `new` / `returning` / `active`
- `goalTier`: `big-pity`（大保底收手）/ `max`（尽量多拿）
- `goal`: 默认抽卡目标。用户可补充现有原石、纠缠之缘、垫数和保底状态后计算个人差额。
- `rankingStrategy`: 资源池的排序方式、优先级权重和默认时间节奏。
- `resourcePool[]`: 候选资源池，不是一张固定每日待办。
  - `sourceId`: 引用 primogems.json 中的来源 ID
  - `priority`: `must-do` / `recommended` / `optional`
  - `status`: `pending` / `in-progress` / `done`（用户在 UI 中更新，存 localStorage）
- `materialPlan`: 同步养成计划
  - `characterIds[]`: 引用角色目录名
  - `weeklySchedule[]`: 按天排布的刷材料计划（周一到周日）
    - `activities[]`: 每天的活动（类型、目标、树脂消耗）
- `timeline[]`: 可选的按天执行计划
  - `planWindow`: 该计划使用的卡池截止时间和剩余天数

### 5. creator.schema.json

定义 UP 主池。

关键字段：
- `specialty[]`: 擅长领域（primogems-guide, character-build, exploration 等）
- `qualityRating`: s / a / b
- `status`: active / inactive / unknown

### 6. one-time-resource.schema.json

永久一次性资源目录，用于主线、世界任务、区域宝箱路线、神瞳路线、成就组和供奉系统。详细模型、证据规则和实施拆分见 [one-time-resource-model.md](one-time-resource-model.md)。

## 版本更新流程

1. 复制 `versions/{旧版本}/` 为 `versions/{新版本}/`
2. 更新 `meta.json`（新版本号、卡池角色、日期）
3. 更新 `primogems.json`（替换为新版本的原石来源）
4. 在 `characters/` 下创建新 UP 角色的 `materials.json`
5. 更新 `packages/` 中的四个套餐（调整任务列表和材料计划）
6. 运行 `node scripts/validate-data.js {新版本}` 校验
7. 更新 `data/current.json` 指向新版本

## 校验脚本

```bash
# 校验当前版本
node scripts/validate-data.js

# 校验指定版本
node scripts/validate-data.js 5.2
```

脚本会检查：
- 所有 JSON 文件可正常解析
- 必填字段是否存在
- 枚举值是否合法

> 如需完整 JSON Schema 校验（含类型检查、格式校验等），安装 ajv：
> `npm install ajv ajv-formats`，然后将脚本中的轻量校验替换为 ajv 调用。
