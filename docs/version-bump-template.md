# 版本数据更新模板

> 每次原神新版本开始时，复制并填写此模板，作为发布前核对清单。

## 版本基本信息

| 字段 | 内容 |
|------|------|
| 版本号 | V7.0 |
| 新区域 | 至冬 |
| 版本起止 | YYYY-MM-DD - YYYY-MM-DD |
| 上半卡池 | 待填写 |
| 下半卡池 | 待填写 |

## 数据文件

- [ ] `data/versions/{version}/meta.json` 已录入上半/下半卡池
- [ ] `data/versions/{version}/primogems.json` 已确认当期原石来源
- [ ] `data/catalog/one-time-resources/` 已更新新区域资源
- [ ] `data/catalog/achievements/` 已新增版本成就
- [ ] `data/creators.json` 是当前攻略 UP 主池
- [ ] `data/catalog/source-links.json` 已补官方/米游社核验链接

## 内容口径

- [ ] 魔神任务原石 / 纠缠之缘数量已确认
- [ ] 世界任务清单已复核，不需要攻略的任务已移除执行攻略
- [ ] 宝箱路线保留估算标注
- [ ] 神瞳 / 供奉系统名称写法正确
- [ ] 成就条数、分类、原石档位与游戏内核验一致
- [ ] 秘境首通奖励已确认（常驻秘境无原石）
- [ ] 版本大型主题活动 / 小型限时活动已填时间
- [ ] 已处理跨版本或跨地区前置警告

## 攻略来源检查

- [ ] 所有执行攻略来自 `data/creators.json`
- [ ] 没有使用池外 UP 主的二次加工视频
- [ ] 没有重复贴同一条龙/宝箱链接
- [ ] 一条龙覆盖任务已按三态（未跟随、已跟随待确认、已确认）处理

## 验证与发布

- [ ] `npm run validate` 通过
- [ ] 本地 `npm start` 打开 UI，完成一次关键路径测试
- [ ] 推送到 GitHub
- [ ] Vercel / Netlify 部署成功
- [ ] 更新 `docs/7.0-content-status.md` 或对应版本状态文档
