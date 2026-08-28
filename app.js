const state = {
  version: null,
  meta: null,
  sources: [],
  packages: [],
  characters: {},
  packageId: null,
  tab: "overview",
  taskFilter: "all",
  characterId: null,
  progress: {},
  guideProgress: {},
  guides: [],
  geography: null,
  evidence: [],
  sourceResources: new Map(),
  profile: {},
  profileOpen: false,
  catalog: [],
  catalogFilter: "all",
  catalogStatusFilter: "all",
  sourceCategory: "limited-time",
  openTaskResources: new Set()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const elementLabels = { anemo: "风", geo: "岩", electro: "雷", dendro: "草", hydro: "水", pyro: "火", cryo: "冰" };
const weaponLabels = { sword: "单手剑", claymore: "双手剑", polearm: "长柄武器", bow: "弓", catalyst: "法器" };
const dayLabels = { mon: "周一", tue: "周二", wed: "周三", thu: "周四", fri: "周五", sat: "周六", sun: "周日" };
const kindLabels = { "archon-quest": "魔神任务", "world-quest": "世界任务", "one-dragon-guide": "一条龙", "story-quest": "传说任务", hangout: "邀约事件", "chest-route": "宝箱路线", "oculus-route": "神瞳路线", "achievement-set": "成就组", "offering-system": "徽印供奉", "domain-first-clear": "秘境首通", other: "其他" };
const activityLabels = { "talent-domain": "天赋材料", "weapon-domain": "专武材料", "normal-boss": "普通 BOSS", "weekly-boss": "周本材料", "artifact-domain": "圣遗物材料", "ley-line-exp": "经验材料", "ley-line-mora": "摩拉材料", exploration: "地图采集", other: "其他安排" };
const difficultyLabels = { easy: "简单", medium: "中等", hard: "困难" };
const methodLabels = { direct: "直接获得", "indirect-offering": "供奉兑换", mixed: "混合" };
const geographyLabels = { confirmed: "已定位到官方地图", "needs-geocoding": "待定位到官方地图" };
const pityOptions = [{ id: "unknown", label: "不知道" }, { id: "0-30", label: "0-30抽" }, { id: "31-60", label: "31-60抽" }, { id: "60-plus", label: "60抽以上" }];
const guaranteeOptions = [{ id: "unknown", label: "不确定" }, { id: "small", label: "小保底" }, { id: "guaranteed", label: "已大保底" }];
const timeOptions = [{ id: "default", label: "不设置" }, { id: "30", label: "每天30分钟" }, { id: "60", label: "每天1小时" }, { id: "120", label: "每天2小时以上" }, { id: "unlimited", label: "时间自由" }];

function activePackage() {
  return state.packages.find((item) => item.id === state.packageId) || state.packages[0];
}

function sourceMap() {
  return new Map(state.sources.map((item) => [item.id, item]));
}

function pool(pkg) {
  return pkg.resourcePool || [];
}

function resourceIdsForTask(task) {
  return state.sourceResources.get(task.sourceId) || [];
}

function catalogById(id) {
  return state.catalog.find((item) => item.id === id);
}

function guideLinksForResource(id, item) {
  const links = [...(item?.guideLinks || [])];
  state.guides.filter((guide) => guide.coverage?.resourceIds?.includes(id)).forEach((guide) => links.push(...(guide.guideLinks || []).map((link) => ({ ...link, title: `一条龙：${link.title || guide.title}` }))));
  return [...new Map(links.map((link) => [link.url, link])).values()];
}

function taskCompleted(task) {
  const ids = resourceIdsForTask(task);
  return ids.length ? ids.every((id) => state.progress[id]) : Boolean(state.progress[task.sourceId]);
}

function defaultProfile() {
  return { primogems: "", intertwinedFates: "", pity: "unknown", pityExact: "", guarantee: "unknown", dailyMinutes: "default" };
}

function loadProfile() {
  try { state.profile = { ...defaultProfile(), ...JSON.parse(localStorage.getItem(`genshin-guide-profile:${state.version}`) || "{}") }; } catch { state.profile = defaultProfile(); }
}

function saveProfile() {
  localStorage.setItem(`genshin-guide-profile:${state.version}`, JSON.stringify(state.profile));
}

function loadProgress() {
  const key = `genshin-guide-progress:${state.version}:${state.packageId}`;
  try { state.progress = JSON.parse(localStorage.getItem(key) || "{}"); } catch { state.progress = {}; }
  try { state.guideProgress = JSON.parse(localStorage.getItem(`${key}:guides`) || "{}") || {}; } catch { state.guideProgress = {}; }
  let migrated = false;
  (activePackage()?.resourcePool || []).forEach((task) => {
    const ids = resourceIdsForTask(task);
    if (ids.length && state.progress[task.sourceId]) {
      ids.forEach((id) => { state.progress[id] = true; });
      delete state.progress[task.sourceId];
      migrated = true;
    }
  });
  if (migrated) saveProgress();
}

function readPackageProgress(packageId) {
  let progress;
  try { progress = JSON.parse(localStorage.getItem(`genshin-guide-progress:${state.version}:${packageId}`) || "{}"); } catch { progress = {}; }
  const pkg = state.packages.find((item) => item.id === packageId);
  let migrated = false;
  (pkg?.resourcePool || []).forEach((task) => {
    const ids = resourceIdsForTask(task);
    if (ids.length && progress[task.sourceId]) {
      ids.forEach((id) => { progress[id] = true; });
      delete progress[task.sourceId];
      migrated = true;
    }
  });
  if (migrated) localStorage.setItem(`genshin-guide-progress:${state.version}:${packageId}`, JSON.stringify(progress));
  return progress;
}

function saveProgress() {
  const key = `genshin-guide-progress:${state.version}:${state.packageId}`;
  localStorage.setItem(key, JSON.stringify(state.progress));
  localStorage.setItem(`${key}:guides`, JSON.stringify(state.guideProgress));
}

function guideCoverageStatus(sourceId) {
  if (state.progress[sourceId]) return "confirmed";
  return Object.values(state.guideProgress).some((guide) => guide?.coverage?.[sourceId] === "followed") ? "followed" : "untracked";
}

function rewardText(rewards) {
  const parts = [];
  if (rewards?.primogems) parts.push(`${rewards.primogems} 原石`);
  if (rewards?.intertwinedFates) parts.push(`${rewards.intertwinedFates} 纠缠之缘`);
  if (rewards?.acquaintFates) parts.push(`${rewards.acquaintFates} 相遇之缘`);
  return parts.length ? parts.join(" · ") : "非抽卡资源 / 待确认";
}

function sourceRewardText(source) {
  return source?.id === "starglitter-exchange" ? "无上限" : rewardText(source?.rewards);
}

function taskBucket(task, source) {
  if (task.availabilityStatus === "expired") return "expired";
  if (task.availabilityStatus === "conditional") return "conditional";
  if (task.availabilityStatus === "unconfirmed") return "pending";
  return source?.verification?.status || "pending";
}

function rewardTotals(pkg) {
  const totals = { confirmed: emptyRewards(), estimated: emptyRewards(), conditional: emptyRewards(), pending: emptyRewards(), expired: emptyRewards() };
  const sources = sourceMap();
  pool(pkg).forEach((task) => {
    const source = sources.get(task.sourceId);
    const bucket = taskBucket(task, source);
    if (!source?.rewards || !totals[bucket]) return;
    addRewards(totals[bucket], source.rewards);
  });
  return totals;
}

function emptyRewards() { return { primogems: 0, intertwinedFates: 0, acquaintFates: 0 }; }
function addRewards(target, source) { Object.keys(target).forEach((key) => { target[key] += source[key] || 0; }); }

function progressStats(pkg, progress = state.progress) {
  const keys = [...new Set(pool(pkg).flatMap((task) => {
    const ids = resourceIdsForTask(task);
    return ids.length ? ids : [task.sourceId];
  }))];
  const done = keys.filter((id) => progress[id]).length;
  return { done, total: keys.length, percent: keys.length ? Math.round((done / keys.length) * 100) : 0 };
}

function ownedWishes() {
  const primogems = Math.max(0, Number(state.profile.primogems) || 0);
  const fates = Math.max(0, Number(state.profile.intertwinedFates) || 0);
  return Math.floor(primogems / 160) + fates;
}

function hasResourceInput() {
  return state.profile.primogems !== "" || state.profile.intertwinedFates !== "";
}

function pityFloor() {
  if (state.profile.pity === "exact") {
    const value = Math.floor(Number(state.profile.pityExact));
    return Number.isFinite(value) ? Math.min(89, Math.max(0, value)) : 0;
  }
  return ({ unknown: 0, "0-30": 0, "31-60": 31, "60-plus": 61 }[state.profile.pity] || 0);
}

function targetState(pkg) {
  if (pkg.goal.mode === "maximize") {
    return { type: "maximize", targetWishes: null, owned: ownedWishes(), gap: null, label: "持续积攒" };
  }
  const currentPity = pityFloor();
  const base = state.profile.guarantee === "guaranteed" ? 90 : pkg.goal.defaultRequiredWishes;
  const targetWishes = Math.max(0, base - currentPity);
  return { type: "fixed", targetWishes, owned: ownedWishes(), gap: Math.max(0, targetWishes - ownedWishes()), label: `${targetWishes} 抽目标` };
}

function strategyDailyLimit(pkg) {
  const setting = state.profile.dailyMinutes;
  if (setting === "30") return Math.min(pkg.rankingStrategy.maxRecommendations, 3);
  if (setting === "60") return Math.min(pkg.rankingStrategy.maxRecommendations, 5);
  if (setting === "120") return Math.min(pkg.rankingStrategy.maxRecommendations, 7);
  if (setting === "unlimited") return Math.max(pkg.rankingStrategy.maxRecommendations, 10);
  return pkg.rankingStrategy.maxRecommendations;
}

function priorityScore(task, source, pkg) {
  const bucket = taskBucket(task, source);
  if (bucket === "expired" || taskCompleted(task)) return -Infinity;
  const confidence = { confirmed: 180, estimated: 85, pending: 20, conditional: 30 }[bucket] || 0;
  const priority = pkg.rankingStrategy.priorityWeights[task.priority] || 0;
  const rewards = source?.rewards || emptyRewards();
  const rewardValue = rewards.primogems + rewards.intertwinedFates * 160;
  const efficiency = Math.min(130, Math.round((rewardValue / Math.max(source?.estimatedMinutes || 20, 20)) * 6));
  const deadline = source?.category === "limited-time" ? 140 : source?.category === "recurring" ? 75 : 0;
  const exploration = source?.subcategory === "exploration" ? (pkg.audience === "new" ? 35 : 10) : 0;
  return confidence + priority + efficiency + deadline + exploration;
}

function recommendedPool(pkg) {
  const sources = sourceMap();
  return pool(pkg)
    .map((task) => ({ task, source: sources.get(task.sourceId), score: priorityScore(task, sources.get(task.sourceId), pkg) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
}

function statusLabel(status) { return ({ confirmed: "已确认", estimated: "估算", pending: "待确认", conditional: "有条件", expired: "已过期" }[status] || "待确认"); }
function statusClass(status) { return ({ confirmed: "confirmed", estimated: "estimated", pending: "pending", conditional: "conditional", expired: "expired" }[status] || "pending"); }
function priorityLabel(priority) { return ({ "must-do": "优先完成", recommended: "值得安排", optional: "有余力再做" }[priority] || priority); }
function audienceLabel(audience) { return ({ new: "新玩家", returning: "回坑玩家", active: "持续游玩" }[audience] || audience); }
function tierLabel(tier) { return tier === "big-pity" ? "大保底收手" : "尽量多拿"; }

function renderPackageList() {
  $("#package-list").innerHTML = state.packages.map((pkg) => {
    const stats = progressStats(pkg, readPackageProgress(pkg.id));
    return `<button class="package-option ${pkg.id === state.packageId ? "is-active" : ""}" data-package="${escapeHtml(pkg.id)}" type="button">
      <span class="package-option-top"><span class="route-pill">${escapeHtml(audienceLabel(pkg.audience))}</span><span class="route-pill">${escapeHtml(tierLabel(pkg.goalTier))}</span></span>
      <h3>${escapeHtml(pkg.title)}</h3>
      <small>${stats.done}/${stats.total} 项已完成 · ${pkg.estimatedTotalHours} 小时估算</small>
    </button>`;
  }).join("");
  $$('[data-package]').forEach((button) => button.addEventListener("click", () => {
    state.packageId = button.dataset.package;
    state.tab = "overview";
    state.taskFilter = "all";
    loadProgress();
    render();
  }));
}

function renderHeader(pkg) {
  const phase = state.meta.phases.find((item) => item.phase === pkg.bannerPhase) || state.meta.phases[0];
  $("#top-version").textContent = `原神 ${state.version} · ${phase.bannerName}`;
  $("#sidebar-version").textContent = state.version;
  $("#footer-version").textContent = `${state.version} · ${pkg.planWindow?.calculatedAt || "--"}`;
  $("#package-audience").textContent = `${audienceLabel(pkg.audience)} / ${tierLabel(pkg.goalTier)}`;
  $("#package-title").textContent = pkg.title;
  $("#package-summary").textContent = pkg.summary;
}

function renderCountdown() {
  const phase = state.meta.phases[0];
  const end = new Date(`${phase.endDate}T17:59:00+08:00`).getTime();
  const start = new Date(`${phase.startDate}T11:00:00+08:00`).getTime();
  const tick = () => {
    const now = Date.now();
    const remaining = Math.max(0, end - now);
    const totalSeconds = Math.floor(remaining / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    $("#countdown").textContent = remaining ? `${d}天 ${String(h).padStart(2, "0")}小时` : "卡池已结束";
    $("#phase-window").textContent = `${phase.startDate.replaceAll("-", ".")} - ${phase.endDate.replaceAll("-", ".")} 17:59`;
    $("#window-left").textContent = remaining ? `还剩 ${d}天 ${h}小时 ${m}分钟` : "请切换到下一期卡池数据";
    $("#window-date").textContent = `目标：${phase.endDate.replaceAll("-", ".")}`;
    $("#window-progress").style.width = `${Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))}%`;
  };
  tick();
  clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(tick, 60000);
}

function statCard(label, value, sub, color) { return `<div class="stat-card ${color}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`; }

function renderStats(pkg) {
  const totals = rewardTotals(pkg);
  const progress = progressStats(pkg);
  const target = targetState(pkg);
  const targetValue = target.type === "fixed" ? `${target.gap} 抽` : "持续";
  const targetSub = target.type === "fixed" ? (hasResourceInput() ? `距离目标还差 ${target.gap * 160} 原石等值` : `默认按 ${target.targetWishes} 抽计算，尚未填写资源`) : "资源池会持续推荐未完成高价值内容";
  return `<div class="stat-grid">
    ${statCard(target.type === "fixed" ? "距离角色目标" : "套餐目标", targetValue, targetSub, "accent")}
    ${statCard("当前抽卡资源", hasResourceInput() ? `${target.owned} 抽` : "未填写", hasResourceInput() ? `${Math.max(0, Number(state.profile.primogems) || 0)} 原石 · ${Math.max(0, Number(state.profile.intertwinedFates) || 0)} 纠缠之缘` : "不填写也可以继续使用套餐", "green")}
    ${statCard("估算原石", `${totals.estimated.primogems.toLocaleString()}`, "将和已确认资源分开显示", "yellow")}
    ${statCard("资源池进度", `${progress.percent}%`, `${progress.done}/${progress.total} 项已完成`, "red")}
  </div>`;
}

function choiceButtons(field, options, current) {
  return options.map((option) => `<button class="choice-button ${current === option.id ? "is-active" : ""}" data-profile-choice="${field}" data-choice-value="${option.id}" type="button">${option.label}</button>`).join("");
}

function renderProfilePanel(pkg) {
  const target = targetState(pkg);
  const summary = target.type === "fixed"
    ? (hasResourceInput() ? `当前按 ${target.targetWishes} 抽保守估算，还差 ${target.gap} 抽。` : `当前使用默认最坏情况 ${target.targetWishes} 抽；补充资源后才会计算个人差额。`)
    : "当前套餐没有抽数上限；补充资源可记录你的现有抽卡储备。";
  return `<section class="profile-panel ${state.profileOpen ? "is-open" : ""}">
    <div class="profile-summary"><div><p class="eyebrow">OPTIONAL PERSONALIZATION</p><h3>让推荐更准确</h3><p>${escapeHtml(summary)}</p></div><button class="outline-button" data-profile-toggle type="button">${state.profileOpen ? "收起设置" : "填写资源"}</button></div>
    ${state.profileOpen ? `<div class="profile-form">
      <div class="profile-field"><label for="profile-primogems">当前原石</label><input id="profile-primogems" data-profile-field="primogems" inputmode="numeric" min="0" type="number" placeholder="可留空" value="${escapeHtml(state.profile.primogems)}" /></div>
      <div class="profile-field"><label for="profile-fates">当前纠缠之缘</label><input id="profile-fates" data-profile-field="intertwinedFates" inputmode="numeric" min="0" type="number" placeholder="可留空" value="${escapeHtml(state.profile.intertwinedFates)}" /></div>
      <div class="profile-field full"><label for="profile-pity-exact">角色池垫数</label>
        <div class="pity-controls">
          <div class="choice-row">${choiceButtons("pity", pityOptions, state.profile.pity)}</div>
          <input id="profile-pity-exact" class="profile-inline-input" data-profile-field="pityExact" data-preset-field="pity" inputmode="numeric" min="0" max="89" type="number" placeholder="精确输入" value="${escapeHtml(state.profile.pityExact)}" />
        </div>
        <small class="field-help">输入后按回车或点击空白处生效；精确垫数优先于快速档位。</small>
      </div>
      <div class="profile-field full"><label>本次是否已大保底</label><div class="choice-row">${choiceButtons("guarantee", guaranteeOptions, state.profile.guarantee)}</div></div>
      <div class="profile-field full"><label>每天预计游戏时间</label><div class="choice-row">${choiceButtons("dailyMinutes", timeOptions, state.profile.dailyMinutes)}</div></div>
      <p class="profile-foot">所有资料只保存在当前浏览器。留空或选择“不知道”时，仍会使用默认套餐策略。</p>
    </div>` : ""}
  </section>`;
}

function taskRow(task, source, compact = false, score = null) {
  const linkedIds = resourceIdsForTask(task);
  const done = taskCompleted(task);
  const followed = linkedIds.filter((id) => guideCoverageStatus(id) === "followed").length;
  const bucket = taskBucket(task, source);
  const reward = sourceRewardText(source);
  const resources = linkedIds.map((id) => {
    const item = catalogById(id);
    const childDone = Boolean(state.progress[id]);
    const childFollowed = guideCoverageStatus(id) === "followed";
    const guideLinks = guideLinksForResource(id, item);
    return `<div class="linked-resource-row">
      <input class="task-check" type="checkbox" data-task-child="${escapeHtml(id)}" ${childDone ? "checked" : ""} aria-label="标记 ${escapeHtml(item?.title || id)} 已完成" />
      <div><div class="linked-resource-title">${escapeHtml(item?.title || id)}<span class="tag ${childDone ? "confirmed" : childFollowed ? "followed" : "optional"}">${childDone ? "已完成" : childFollowed ? "已跟随待确认" : "未完成"}</span></div>
        <div class="task-meta"><span>${kindLabels[item?.kind] || "资源"}</span><span>${rewardText(item?.rewards)}</span></div>
        ${guideLinks.length ? `<div class="source-links linked-resource-guides">${guideLinks.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">攻略：${escapeHtml(link.title || "打开攻略")} ↗</a>`).join("")}</div>` : ""}
      </div>
    </div>`;
  }).join("");
  const resourcesOpen = linkedIds.length && !compact && state.openTaskResources.has(task.sourceId) && !done;
  const groupCheck = linkedIds.length
    ? `<input class="task-check" type="checkbox" data-task-group="${escapeHtml(task.sourceId)}" ${done ? "checked" : ""} aria-label="标记 ${escapeHtml(source?.name)} 全部子资源已完成" />`
    : "";
  const singleCheck = !linkedIds.length
    ? `<input class="task-check" type="checkbox" data-task="${escapeHtml(task.sourceId)}" ${done ? "checked" : ""} aria-label="标记 ${escapeHtml(source?.name)} 已完成" />`
    : "";
  return `<article class="task-row ${done ? "is-done" : ""}">
    ${groupCheck || singleCheck}
    <div class="task-content"><div class="task-head"><div class="task-primary"><div class="task-title ${done ? "is-done" : ""}">${escapeHtml(source?.name || task.sourceId)}</div>
      <div class="task-meta"><span class="tag ${task.priority === "must-do" ? "must" : task.priority === "recommended" ? "recommended" : "optional"}">${priorityLabel(task.priority)}</span><span class="tag ${statusClass(bucket)}">${statusLabel(bucket)}</span>${followed && !done ? `<span class="tag followed">一条龙已跟随 ${followed}/${linkedIds.length}</span>` : ""}<span>${source?.estimatedMinutes || 0} 分钟</span>${score !== null ? `<span>推荐分 ${score}</span>` : ""}</div>
      ${task.note && !compact ? `<div class="task-meta">${escapeHtml(task.note)}</div>` : ""}</div>
      <div class="task-reward">${escapeHtml(reward)}</div></div>
      ${!compact && source?.eventInfo ? `<section class="event-info"><div class="event-info-head"><strong>${escapeHtml(source.eventInfo.title)}</strong><span class="event-info-label">活动说明</span></div><p>${escapeHtml(source.eventInfo.summary)}</p><dl><div><dt>开放窗口</dt><dd>${escapeHtml(source.eventInfo.window)}</dd></div><div><dt>参与前提</dt><dd>${escapeHtml(source.eventInfo.requirements)}</dd></div><div><dt>奖励口径</dt><dd>${escapeHtml(source.eventInfo.rewardNote)}</dd></div></dl></section>` : ""}
      ${!compact && linkedIds.length ? `<details class="task-resources" data-task-source="${escapeHtml(task.sourceId)}" ${resourcesOpen ? "open" : ""}><summary><span>关联一次性资源</span><span>${linkedIds.filter((id) => state.progress[id]).length}/${linkedIds.length} 已完成</span></summary><div class="linked-resource-list">${resources}</div></details>` : ""}
      ${compact && linkedIds.length ? `<button class="small-link" data-tab-link="tasks" type="button">查看 ${linkedIds.length} 项子资源 →</button>` : ""}
      ${!compact && !linkedIds.length && source?.guideLinks?.length ? `<div class="source-links task-guide-links">${source.guideLinks.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">查看执行攻略：${escapeHtml(link.title || "打开攻略")} ↗</a>`).join("")}</div>` : ""}
    </div>
  </article>`;
}

function renderOverview(pkg) {
  const totals = rewardTotals(pkg);
  const recommendations = recommendedPool(pkg).slice(0, strategyDailyLimit(pkg));
  return `${renderStats(pkg)}${renderProfilePanel(pkg)}
    <div class="guide-note">资源池覆盖整个卡池期，不会每天替换清单。这里根据套餐策略、资源可信度、期限、单位时间收益和你的已完成项，挑出下一批值得做的内容。</div>
    <div class="content-grid section-band">
      <section class="framed-panel"><div class="panel-title-row"><div><h3>下一批推荐</h3><p class="muted">${state.profile.dailyMinutes === "default" ? `采用套餐默认节奏（${pkg.rankingStrategy.defaultDailyMinutes} 分钟/天）` : "已按你的时间偏好缩放推荐范围"}</p></div><button class="small-link" data-tab-link="tasks" type="button">查看资源池 →</button></div>
        <div class="task-list">${recommendations.length ? recommendations.map((item) => taskRow(item.task, item.source, true, item.score)).join("") : `<div class="empty-state">当前资源池已完成或只剩过期项目。</div>`}</div>
      </section>
      <section class="framed-panel"><div class="panel-title-row"><h3>奖励口径</h3><span class="tag confirmed">分开统计</span></div><div class="info-grid" style="grid-template-columns:1fr">
        <div class="info-block"><strong>已确认</strong><p>${totals.confirmed.primogems} 原石<br />${totals.confirmed.intertwinedFates} 纠缠之缘 · ${totals.confirmed.acquaintFates} 相遇之缘</p></div>
        <div class="info-block"><strong>估算 / 待确认</strong><p>${totals.estimated.primogems} 估算原石 · ${totals.pending.primogems} 待确认原石</p></div>
        <div class="info-block"><strong>条件性</strong><p>${totals.conditional.intertwinedFates} 纠缠之缘 · ${totals.conditional.acquaintFates} 相遇之缘，需要已有星尘、星辉或纪行条件。</p></div>
      </div></section>
    </div>
    <section class="section-band"><div class="section-head"><div><h3>本期执行节奏</h3><p>资源池不会消失；时间多就继续向下做，时间少就优先完成上方推荐。</p></div></div><div class="framed-panel"><div class="timeline">${(pkg.timeline || []).map((item) => `<div class="timeline-item"><div class="timeline-date"><span class="timeline-marker"></span><span>${escapeHtml(item.dayRange)}</span></div><div class="timeline-copy"><h4>${escapeHtml(item.focus)}</h4><p>${escapeHtml(item.notes || "")}</p></div></div>`).join("")}</div></div></section>`;
}

function renderTasks(pkg) {
  const filters = [{ id: "all", label: "全部" }, { id: "must-do", label: "优先完成" }, { id: "recommended", label: "值得安排" }, { id: "optional", label: "有余力再做" }];
  const sources = sourceMap();
  const priorityRank = { "must-do": 0, recommended: 1, optional: 2 };
  const ranked = pool(pkg)
    .map((task) => ({ task, source: sources.get(task.sourceId), score: priorityScore({ ...task, availabilityStatus: taskCompleted(task) ? "completed" : task.availabilityStatus }, sources.get(task.sourceId), pkg), done: taskCompleted(task) }))
    .sort((a, b) => Number(a.done) - Number(b.done) || priorityRank[a.task.priority] - priorityRank[b.task.priority] || b.score - a.score);
  const tasks = ranked.filter((item) => state.taskFilter === "all" || item.task.priority === state.taskFilter);
  const stats = progressStats(pkg);
  return `${renderStats(pkg)}<section class="framed-panel"><div class="panel-title-row"><div><h3>资源池</h3><div class="progress-summary"><span>${stats.done}/${stats.total} 已完成</span><span class="mini-track"><span style="width:${stats.percent}%"></span></span></div></div><span class="muted">已完成和过期项目不会进入下一批推荐</span></div>
    <div class="priority-bar">${filters.map((filter) => `<button class="filter-button ${state.taskFilter === filter.id ? "is-active" : ""}" data-filter="${filter.id}" type="button">${filter.label}</button>`).join("")}</div>
    <div class="task-list">${tasks.length ? tasks.map((item) => taskRow(item.task, item.source, false, item.score)).join("") : `<div class="empty-state">这个筛选下没有可继续推荐的资源。</div>`}</div></section>`;
}

function materialData() {
  const pkg = activePackage();
  const characterIds = pkg.materialPlan?.characterIds || [];
  if (!state.characterId || !characterIds.includes(state.characterId)) state.characterId = characterIds[0];
  return state.characters[state.characterId];
}

function materialActivity(activity) {
  const type = activityLabels[activity.type] || activity.type || "其他安排";
  const typeMarkup = activity.type === "normal-boss"
    ? `<span class="boss-label-main">普通</span><span class="boss-label-sub">BOSS</span>`
    : escapeHtml(type);
  const resin = Number(activity.resin) || 0;
  let target = activity.target || "未命名安排";
  let note = activity.note || "";
  if (activity.type === "normal-boss") {
    target = target.replace(/（[^）]*）/g, "").replace(/\s+/g, " ").trim();
  } else {
    const match = target.match(/^(.*?)（(.+?)）$/);
    if (match) {
      target = match[1];
      note = [match[2], note].filter(Boolean).join(" · ");
    }
  }
  const noteParts = note.split(/[·/]/).map((item) => item.trim()).filter(Boolean);
  const noteTags = [...new Set(noteParts.flatMap((item) => {
    const characters = ["奥黛塔", "阿蕾奇诺", "多托雷"].filter((name) => item.includes(name));
    if (characters.length) return characters;
    const cleaned = item.replace(/天赋与专武材料|天赋\+武器周本材料|天赋本|武器本|特产$/g, "").trim();
    return cleaned ? [cleaned] : [];
  }))];
  const noteMarkup = noteTags.map((item) => `<span class="activity-note-tag">${escapeHtml(item)}</span>`).join("");
  const targetMarkup = activity.type === "weekly-boss"
    ? target.split("/").map((item) => item.trim()).filter(Boolean).map((item) => `<span class="weekly-boss-line">${escapeHtml(item.endsWith("周本") ? item : `${item}周本`)}</span>`).join("")
    : escapeHtml(target);
  return `<article class="day-activity">
    <div class="day-activity-head"><span class="activity-type">${typeMarkup}</span>${resin ? `<span class="resin">${resin} 树脂</span>` : ""}</div>
    <strong class="activity-target ${activity.type === "normal-boss" ? "normal-boss-target" : ""}">${targetMarkup}</strong>
    ${noteTags.length ? `<div class="activity-note">${noteMarkup}</div>` : ""}
  </article>`;
}

function renderMaterials(pkg) {
  const character = materialData();
  const charIds = pkg.materialPlan?.characterIds || [];
  const c = character?.character || {};
  const a = character?.ascension || {};
  return `<section class="framed-panel"><div class="panel-title-row"><div><h3>养成计划</h3><p class="muted">攒原石期间同步准备，抽到后减少等待刷新时间。</p></div><span class="tag confirmed">${escapeHtml(c.name || "角色")}</span></div>
    <div class="material-character-tabs">${charIds.map((id) => `<button class="character-tab ${id === state.characterId ? "is-active" : ""}" data-character="${id}" type="button">${escapeHtml(state.characters[id]?.character?.name || id)}</button>`).join("")}</div>
    <div class="material-summary"><div class="material-cell"><small>元素 / 武器</small><strong>${escapeHtml(elementLabels[c.element] || c.element || "--")} · ${escapeHtml(weaponLabels[c.weaponType] || c.weaponType || "--")}${character?.weapon?.name ? `：${escapeHtml(character.weapon.name)}` : ""}</strong></div><div class="material-cell"><small>地区特产</small><strong>${escapeHtml(a.localSpecialty?.name || "--")} · ${a.localSpecialty?.totalNeeded || "--"}</strong></div><div class="material-cell"><small>普通 BOSS</small><strong>${escapeHtml(a.normalBoss?.name || "--")}</strong></div><div class="material-cell"><small>特产刷新</small><strong>${a.localSpecialty?.growthTime || "--"} 小时</strong></div></div>
    <div class="info-grid"><div class="info-block"><strong>天赋材料</strong><p>${escapeHtml(character?.talents?.[0]?.book?.name || "--")}<br />${escapeHtml(character?.talents?.[0]?.book?.domainName || "--")} · ${escapeHtml((character?.talents?.[0]?.book?.availableDays || []).map((day) => dayLabels[day] || day).join(" / "))}</p></div><div class="info-block"><strong>周本材料</strong><p>${escapeHtml(character?.talents?.[0]?.weeklyBoss?.name || "--")}<br />${escapeHtml(character?.talents?.[0]?.weeklyBoss?.drop || "--")}</p></div><div class="info-block"><strong>圣遗物建议</strong><p>${escapeHtml(character?.misc?.artifactDomain?.name || "--")}<br />${escapeHtml(character?.misc?.artifactDomain?.set || "--")}</p></div></div>
  </section><section class="framed-panel material-week-panel"><div class="panel-title-row"><div><h3>每周体力安排</h3><p class="muted">按当前套餐的角色目标安排，实际树脂可按库存调整。</p></div><span class="tag confirmed">7 天安排</span></div><div class="week-grid">${(pkg.materialPlan?.weeklySchedule || []).map((day, index) => `<article class="day-column"><header class="day-header"><span class="day-index">${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(days[index] || day.day)}</h4><span class="day-count">${day.activities?.length || 0} 项</span></header><div class="day-activities">${(day.activities || []).map(materialActivity).join("")}</div></article>`).join("")}</div></section>`;
}

function renderSources() {
  const sourceKindLabels = { official: "官方", miyoushe: "米游社", bilibili: "哔哩哔哩", creator: "攻略UP主", web: "网页", other: "其他" };
  const categoryLabels = { "limited-time": "限时资源", recurring: "周期资源", "one-time": "一次性资源" };
  const subcategoryLabels = { maintenance: "维护补偿", "live-stream": "前瞻直播", "daily-commission": "每日委托", exchange: "商店兑换", "archon-quest": "魔神任务", exploration: "探索与首通", "world-quest": "世界任务", achievement: "成就", "spiral-abyss": "深境螺旋", "imaginary-theater": "幻想真境剧诗", event: "版本活动", "web-event": "网页活动", other: "其他" };
  const categoryOrder = ["limited-time", "recurring", "one-time"];
  const groups = categoryOrder.map((category) => ({ category, items: state.sources.filter((source) => source.category === category) })).filter((group) => group.items.length);
  const confirmed = state.sources.filter((source) => source.verification?.status === "confirmed").length;
  const activeGroup = groups.find((group) => group.category === state.sourceCategory) || groups[0];
  const sourceGroup = activeGroup ? `<section class="source-group"><div class="source-group-head"><div><span class="eyebrow">${categoryLabels[activeGroup.category]}</span><h4>${categoryLabels[activeGroup.category]}</h4></div><span class="source-group-count">${activeGroup.items.length} 条</span></div><div class="source-list">${activeGroup.items.map((source) => `<article class="source-card"><div class="source-card-top"><div><div class="source-kicker"><span class="tag optional">${escapeHtml(subcategoryLabels[source.subcategory] || source.subcategory || "其他")}</span><span class="tag ${statusClass(source.verification?.status)}">${statusLabel(source.verification?.status)}</span></div><h4>${escapeHtml(source.name)}</h4></div><span class="task-reward">${escapeHtml(sourceRewardText(source))}</span></div><div class="source-card-meta"><span>${source.isOneTime ? "完成一次" : "可重复 / 按周期"}</span><span>${source.estimatedMinutes ? `${source.estimatedMinutes} 分钟` : "领取不额外耗时"}</span>${source.verification?.checkedAt ? `<span>核验于 ${escapeHtml(source.verification.checkedAt)}</span>` : ""}</div><p>${escapeHtml(source.description || "")}</p>${source.amount?.note ? `<p class="source-card-note">${escapeHtml(source.amount.note)}</p>` : ""}${source.verification?.note ? `<p class="source-card-verification"><span>核验口径</span>${escapeHtml(source.verification.note)}</p>` : ""}</article>`).join("")}</div></section>` : `<div class="empty-state">暂无资源记录。</div>`;
  const evidence = state.evidence.map((item) => `<article class="source-card"><div class="source-card-top"><h4>${escapeHtml(item.source?.title || item.id)}</h4><span class="tag confirmed">${escapeHtml(sourceKindLabels[item.source?.kind] || item.source?.kind || "来源")}</span></div><p>${escapeHtml(item.notes || "")}</p>${item.source?.url ? `<div class="source-links"><a href="${escapeHtml(item.source.url)}" target="_blank" rel="noreferrer">打开核验来源 ↗</a></div>` : ""}</article>`).join("");
  return `<section class="framed-panel source-library-panel"><div class="source-library-intro"><div><p class="eyebrow">VERSION SOURCES</p><h3>版本来源库</h3><p class="muted">记录本版本可获得的原石与祈愿道具，并区分资源性质、奖励口径和核验状态。</p></div><div class="source-library-stats"><strong>${state.sources.length}</strong><span>条资源记录</span><strong>${confirmed}</strong><span>已确认</span></div></div><div class="source-category-tabs">${groups.map((group) => `<button class="source-category-tab ${group.category === activeGroup?.category ? "is-active" : ""}" data-source-category="${group.category}" type="button"><span>${categoryLabels[group.category]}</span><small>${group.items.length} 条</small></button>`).join("")}</div><div class="source-groups">${sourceGroup}</div></section>
    <section class="framed-panel source-evidence-panel"><div class="source-library-intro"><div><p class="eyebrow">VERIFICATION SOURCES</p><h3>资源核验来源</h3><p class="muted">官方公告、官网、米游社文章或游戏内界面用于确认奖励、前置和版本信息。</p></div><div class="source-library-stats"><strong>${state.evidence.length}</strong><span>条核验来源</span></div></div><div class="source-list">${evidence || `<div class="empty-state">暂无独立核验来源。</div>`}</div></section>`;
}

function catalogTimeLabel(estimatedMinutes) {
  if (!estimatedMinutes || estimatedMinutes.typical === 0) return "领取不额外耗时";
  const { min, typical, max } = estimatedMinutes;
  return min === max ? `约 ${typical} 分钟` : `约 ${min}-${max} 分钟（通常 ${typical} 分钟）`;
}

function catalogStatusMenu() {
  const options = [{ id: "all", label: "全部状态" }, { id: "pending", label: "未完成" }, { id: "completed", label: "已完成" }];
  const current = options.find((option) => option.id === state.catalogStatusFilter) || options[0];
  return `<div class="catalog-status-filter"><button class="catalog-filter-icon ${state.catalogStatusFilter !== "all" ? "is-active" : ""}" data-catalog-status-toggle type="button" title="完成状态筛选" aria-label="完成状态筛选"><span class="filter-icon" aria-hidden="true"></span></button><div class="catalog-status-menu" data-catalog-status-menu><span class="catalog-status-current">${current.label}</span>${options.map((option) => `<button class="catalog-status-option ${option.id === state.catalogStatusFilter ? "is-active" : ""}" data-catalog-status="${option.id}" type="button">${option.label}</button>`).join("")}</div></div>`;
}

function catalogStatusMatch(completed) {
  return state.catalogStatusFilter === "all" || (state.catalogStatusFilter === "completed" ? completed : !completed);
}

function catalogToolbar(filters) {
  return `<div class="catalog-toolbar"><div class="priority-bar">${filters.map((filter) => `<button class="filter-button ${state.catalogFilter === filter.id ? "is-active" : ""}" data-catalog-filter="${filter.id}" type="button">${filter.label}</button>`).join("")}</div>${catalogStatusMenu()}</div>`;
}

function renderCatalog() {
  const filters = [{ id: "all", label: "全部" }, { id: "archon-quest", label: "魔神任务" }, { id: "world-quest", label: "世界任务" }, { id: "chest-route", label: "宝箱路线" }, { id: "oculus-route", label: "神瞳路线" }, { id: "achievement-set", label: "成就" }, { id: "offering-system", label: "徽印供奉" }, { id: "one-dragon-guide", label: "一条龙" }];
  if (state.catalogFilter === "one-dragon-guide") return renderOneDragon(filters);
  const items = state.catalog.filter((item) => (state.catalogFilter === "all" || item.kind === state.catalogFilter) && catalogStatusMatch(Boolean(state.progress[item.id])));
  const byStatus = items.reduce((result, item) => {
    const status = item.verification?.status || "pending";
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});

  return `<section class="catalog-intro"><div><p class="eyebrow">PERMANENT RESOURCES</p><h3>一次性资源目录</h3><p>这是一份跨版本、按完成批次管理的永久资源库。部分一条龙路线、宝箱、神瞳和供奉奖励会互相覆盖，因此目录不提供总原石合计；请以单条卡片的奖励与核验说明为准。</p></div><div class="catalog-totals"><span><strong>${items.length}</strong> 条资源</span><span><strong>${byStatus.confirmed || 0}</strong> 已确认</span><span><strong>${byStatus.estimated || 0}</strong> 估算</span><span><strong>${byStatus.pending || 0}</strong> 待确认</span></div></section>
    <section class="framed-panel"><div class="panel-title-row"><div><h3>至冬 · 7.0</h3><p class="muted">已确认 ${byStatus.confirmed || 0} 条，估算 ${byStatus.estimated || 0} 条，待确认 ${byStatus.pending || 0} 条。数值状态会随核验更新。</p></div><span class="tag confirmed">已录入</span></div>
      ${catalogToolbar(filters)}
    <div class="catalog-list">${items.length ? items.map((item) => { const completed = Boolean(state.progress[item.id]); return `<article class="catalog-card"><div class="catalog-card-top"><div><div class="catalog-kicker"><span class="tag optional">${escapeHtml(item._regionName || item.regionId)}</span><span class="tag optional">${escapeHtml(kindLabels[item.kind] || item.kind)}</span><span class="tag ${statusClass(item.verification?.status)}">${statusLabel(item.verification?.status)}</span>${item.geographyStatus ? `<span class="tag ${item.geographyStatus === "confirmed" ? "confirmed" : "pending"}">${escapeHtml(geographyLabels[item.geographyStatus] || item.geographyStatus)}</span>` : ""}${completed ? `<span class="tag catalog-completed-tag">已完成</span>` : ""}</div><h4>${escapeHtml(item.title)}</h4></div><div class="catalog-reward-stack"><div class="task-reward">${escapeHtml(rewardText(item.rewards))}</div><button class="catalog-complete-button ${completed ? "is-complete" : ""}" data-catalog-complete="${escapeHtml(item.id)}" type="button">${completed ? "已完成" : "标记已完成"}</button></div></div>
        <div class="catalog-meta"><span>${escapeHtml(catalogTimeLabel(item.estimatedMinutes))}</span><span>${escapeHtml(difficultyLabels[item.difficulty] || item.difficulty)}</span><span>${escapeHtml(methodLabels[item.rewardMethod] || item.rewardMethod)}</span><span>${item.completionGranularity === "batch" ? "按路线批次完成" : "单项完成"}</span></div>
        ${item.settlement ? `<p class="catalog-geography">${escapeHtml(item.settlement.kind)}：${escapeHtml(item.settlement.name)}</p>` : ""}${item.offeringCurrency ? `<p class="catalog-geography">供奉货币：${escapeHtml(item.offeringCurrency)}</p>` : ""}${item.coverageNotes?.length ? `<p class="catalog-geography">覆盖子区域：${escapeHtml(item.coverageNotes.join("、"))}</p>` : ""}${item.subregionId ? `<p class="catalog-geography">官方地图子区域：${escapeHtml(item.subregionId)}</p>` : ""}${item.achievementSummary ? `<p class="catalog-geography">${item.achievementSummary.itemCount} 项 / ${item.achievementSummary.verifiedPrimogems} 原石：${escapeHtml(item.achievementSummary.categories.map((category) => `${category.name} ${category.count} 项`).join("、"))}</p>` : ""}${item.sourceLabels?.length && !item.achievementSummary ? `<p class="catalog-geography">来源标签：${escapeHtml(item.sourceLabels.join("、"))}</p>` : ""}
        ${item.prerequisiteIds?.length ? `<p class="catalog-prerequisites">前置：${escapeHtml(item.prerequisiteIds.join("、"))}</p>` : ""}
        ${item.verification?.note ? `<p class="catalog-note">${escapeHtml(item.verification.note)}</p>` : ""}
        <div class="source-links">${(item.guideLinks || []).map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${link.kind === "creator" ? "执行攻略：" : "核验来源："}${escapeHtml(link.title || "打开链接")} ↗</a>`).join("") || `<span class="no-links">链接待补充</span>`}</div></article>`; }).join("") : `<div class="empty-state">这个分类下还没有录入资源。</div>`}</div>
    </section>`;
}

function guideStatusLabel(status) {
  return status === "followed" ? "已跟随，待确认" : status === "confirmed" ? "已确认" : "未跟随";
}

function guideCoverageRows(guide) {
  const sources = new Map(state.catalog.map((item) => [item.id, item]));
  return guide.coverage.resourceIds.map((id) => {
    const source = sources.get(id);
    const status = state.progress[id] ? "confirmed" : state.guideProgress[guide.id]?.coverage?.[id] || "untracked";
    return `<div class="guide-coverage-row"><span>${escapeHtml(source?.title || id)}</span><span class="tag ${status === "confirmed" ? "confirmed" : status === "followed" ? "followed" : "optional"}">${guideStatusLabel(status)}</span>${status === "followed" ? `<button class="small-link" data-guide-confirm="${escapeHtml(guide.id)}" data-guide-resource="${escapeHtml(id)}" type="button">确认完成</button>` : status === "confirmed" ? `<button class="small-link" data-guide-unconfirm="${escapeHtml(id)}" type="button">撤销确认</button>` : ""}</div>`;
  }).join("");
}

function renderOneDragon(filters) {
  const guides = state.guides.filter((guide) => {
    const completed = guide.coverage.resourceIds.every((id) => state.progress[id]);
    return catalogStatusMatch(completed);
  });
  const confirmedGuides = guides.filter((guide) => guide.verification?.status === "declared").length;
  return `<section class="catalog-intro"><div><p class="eyebrow">PERMANENT RESOURCES</p><h3>一次性资源目录</h3><p>这是一份跨版本、按完成批次管理的永久资源库。部分一条龙路线、宝箱、神瞳和供奉奖励会互相覆盖，因此目录不提供总原石合计；请以单条卡片的奖励与核验说明为准。</p></div><div class="catalog-totals"><span><strong>${guides.length}</strong> 条攻略</span><span><strong>${confirmedGuides}</strong> 已录入</span><span><strong>0</strong> 奖励来源</span><span><strong>0</strong> 自动完成</span></div></section>
    <section class="framed-panel"><div class="panel-title-row"><div><h3>至冬 · 7.0</h3><p class="muted">一条龙作为多个资源的执行入口，不是新的奖励来源。标记跟随后，仍需逐项确认覆盖资源。</p></div><span class="tag confirmed">执行攻略</span></div>
      ${catalogToolbar(filters)}
      <div class="guide-note">视频中声明覆盖的资源会标记为“已跟随，待确认”；只有你逐项确认后，资源才会从其他清单中排除。</div>
      <div class="catalog-list">${guides.length ? guides.map((guide) => { const followed = state.guideProgress[guide.id]?.status === "followed"; const confirmed = guide.coverage.resourceIds.filter((id) => state.progress[id]).length; const completed = guide.coverage.resourceIds.every((id) => state.progress[id]); return `<article class="catalog-card"><div class="catalog-card-top"><div><div class="catalog-kicker"><span class="tag optional">${escapeHtml(guide._regionName || guide.countryId)}</span><span class="tag confirmed">影月月</span><span class="tag ${guide.verification.status === "declared" ? "confirmed" : "pending"}">${guide.verification.status === "declared" ? "已按视频声明录入" : "待核对"}</span>${completed ? `<span class="tag catalog-completed-tag">已完成</span>` : ""}</div><h4>${escapeHtml(guide.title)}</h4></div><span class="tag ${followed ? "followed" : "optional"}">${followed ? `已跟随 ${confirmed}/${guide.coverage.resourceIds.length}` : "未跟随"}</span></div>
        <div class="catalog-meta"><span>约 ${guide.estimatedMinutes.min}-${guide.estimatedMinutes.max} 分钟（通常 ${guide.estimatedMinutes.typical} 分钟）</span><span>覆盖 ${guide.coverage.resourceIds.length} 项可核对资源</span></div>
        <p class="catalog-geography">覆盖地图子区域：${escapeHtml(guide.subregionIds.map((id) => state.geography?.subregions?.find((item) => item.id === id)?.name || id).join("、"))}</p>
        <div class="guide-declarations">${guide.coverage.declaredItems.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div><p class="catalog-note">${escapeHtml(guide.coverage.disclaimer)}</p>
        <div class="source-links">${guide.guideLinks.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.title)} ↗</a>`).join("")}<button class="solid-button guide-follow-button" data-guide-follow="${escapeHtml(guide.id)}" type="button">${followed ? "已跟随视频" : "标记已跟随"}</button></div>
        ${followed ? `<details class="guide-coverage"><summary><span>覆盖项目逐项确认</span><span class="muted">${confirmed}/${guide.coverage.resourceIds.length} 已确认</span></summary>${guideCoverageRows(guide)}</details>` : ""}</article>`; }).join("") : `<div class="empty-state">暂未录入一条龙攻略。</div>`}</div></section>`;
}

function updateLinkedResourceCheckbox(checkbox) {
  const resourceId = checkbox.dataset.taskChild;
  const details = checkbox.closest("details.task-resources");
  const sourceId = details?.dataset.taskSource;
  const task = sourceId ? pool(activePackage()).find((item) => item.sourceId === sourceId) : null;
  const ids = task ? resourceIdsForTask(task) : [];
  const wasDone = ids.length > 0 && ids.every((id) => state.progress[id]);
  if (checkbox.checked) state.progress[resourceId] = true; else delete state.progress[resourceId];
  const completedCount = ids.filter((id) => state.progress[id]).length;
  const allDone = ids.length > 0 && completedCount === ids.length;
  const row = checkbox.closest(".linked-resource-row");
  const childFollowed = guideCoverageStatus(resourceId) === "followed";
  const tag = row?.querySelector(".linked-resource-title .tag");
  if (tag) {
    tag.className = `tag ${checkbox.checked ? "confirmed" : childFollowed ? "followed" : "optional"}`;
    tag.textContent = checkbox.checked ? "已完成" : childFollowed ? "已跟随待确认" : "未完成";
  }
  const summary = details?.querySelector("summary");
  if (summary && summary.children.length > 1) summary.children[1].textContent = `${completedCount}/${ids.length} 已完成`;
  const article = checkbox.closest("article.task-row");
  const title = article?.querySelector(".task-title");
  const groupCheck = article?.querySelector('[data-task-group]');
  if (article && title) {
    article.classList.toggle("is-done", allDone);
    title.classList.toggle("is-done", allDone);
  }
  if (groupCheck) groupCheck.checked = allDone;
  if (details && allDone) {
    details.removeAttribute("open");
    state.openTaskResources.delete(sourceId);
  }
  if (allDone && article) moveCompletedLinkedRow(article, task);
  if (!allDone && article && wasDone) moveTaskRowBackToIncomplete(article, task);
  saveProgress();
}

function moveTaskRowBackToIncomplete(article, task) {
  const list = article.closest(".task-list");
  if (!list) return;
  const priorityRank = { "must-do": 0, recommended: 1, optional: 2 };
  const rank = priorityRank[task?.priority];
  list.removeChild(article);
  if (rank === undefined) {
    list.appendChild(article);
    return;
  }
  let insertBefore = null;
  for (const row of [...list.querySelectorAll(":scope > article.task-row")]) {
    const rowSourceId = row.querySelector("[data-task-group]")?.dataset.taskGroup;
    const rowTask = rowSourceId && pool(activePackage()).find((item) => item.sourceId === rowSourceId);
    const rowRank = priorityRank[rowTask?.priority];
    if (row.classList.contains("is-done") || rowRank > rank) {
      insertBefore = row;
      break;
    }
  }
  if (insertBefore) list.insertBefore(article, insertBefore); else list.appendChild(article);
}

function moveCompletedLinkedRow(article, task) {
  const list = article.closest(".task-list");
  if (!list) return;
  const priorityRank = { "must-do": 0, recommended: 1, optional: 2 };
  const rank = priorityRank[task?.priority];
  list.removeChild(article);
  if (rank === undefined) {
    list.appendChild(article);
    return;
  }
  let insertBefore = null;
  for (const row of [...list.querySelectorAll(":scope > article.task-row")]) {
    if (!row.classList.contains("is-done")) continue;
    const sourceId = row.querySelector("[data-task-group]")?.dataset.taskGroup || row.querySelector("[data-task]")?.dataset.task;
    const rowTask = sourceId && pool(activePackage()).find((item) => item.sourceId === sourceId);
    if (priorityRank[rowTask?.priority] > rank) {
      insertBefore = row;
      break;
    }
  }
  if (insertBefore) list.insertBefore(article, insertBefore); else list.appendChild(article);
}

function renderKeepScroll() {
  const scrollY = window.scrollY;
  render();
  requestAnimationFrame(() => window.scrollTo(0, scrollY));
}

function bindContentEvents() {
  $$('[data-task]').forEach((checkbox) => checkbox.addEventListener("change", () => { state.progress[checkbox.dataset.task] = checkbox.checked; if (!checkbox.checked) delete state.progress[checkbox.dataset.task]; saveProgress(); renderKeepScroll(); }));
  $$('[data-task-group]').forEach((checkbox) => checkbox.addEventListener("change", () => {
    const sourceId = checkbox.dataset.taskGroup;
    const task = pool(activePackage()).find((item) => item.sourceId === sourceId);
    const ids = resourceIdsForTask(task);
    ids.forEach((id) => { if (checkbox.checked) state.progress[id] = true; else delete state.progress[id]; });
    if (ids.length && ids.every((id) => state.progress[id])) state.openTaskResources.delete(sourceId);
    saveProgress(); renderKeepScroll();
  }));
  $$('[data-task-child]').forEach((checkbox) => checkbox.addEventListener("change", () => {
    updateLinkedResourceCheckbox(checkbox);
  }));
  $$('details.task-resources').forEach((details) => details.addEventListener("toggle", () => {
    const sourceId = details.dataset.taskSource;
    if (!sourceId) return;
    if (details.open) state.openTaskResources.add(sourceId); else state.openTaskResources.delete(sourceId);
  }));
  $$('[data-catalog-complete]').forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.catalogComplete;
    if (state.progress[id]) delete state.progress[id]; else state.progress[id] = true;
    saveProgress(); renderKeepScroll();
  }));
  $$('[data-tab-link]').forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tabLink; render(); }));
  $$('[data-filter]').forEach((button) => button.addEventListener("click", () => { state.taskFilter = button.dataset.filter; render(); }));
  $$('[data-character]').forEach((button) => button.addEventListener("click", () => { state.characterId = button.dataset.character; render(); }));
  $$('[data-profile-toggle]').forEach((button) => button.addEventListener("click", () => { state.profileOpen = !state.profileOpen; render(); }));
  $$('[data-profile-choice]').forEach((button) => button.addEventListener("click", () => { state.profile[button.dataset.profileChoice] = button.dataset.choiceValue; if (button.dataset.profileChoice === "pity") state.profile.pityExact = ""; saveProfile(); render(); }));
  $$('[data-profile-field]').forEach((input) => input.addEventListener("change", () => {
    let value = input.value;
    if (input.dataset.profileField === "pityExact") {
      if (value === "") {
        state.profile[input.dataset.presetField] = "unknown";
      } else {
        const exact = Math.min(89, Math.max(0, Math.floor(Number(value))));
        value = Number.isFinite(exact) ? String(exact) : "";
        state.profile[input.dataset.presetField] = value ? "exact" : "unknown";
      }
    }
    state.profile[input.dataset.profileField] = value;
    saveProfile(); render();
  }));
  $$('[data-catalog-filter]').forEach((button) => button.addEventListener("click", () => { state.catalogFilter = button.dataset.catalogFilter; render(); }));
  $$('[data-catalog-status-toggle]').forEach((button) => button.addEventListener("click", () => { button.closest(".catalog-status-filter")?.classList.toggle("is-open"); }));
  $$('[data-catalog-status]').forEach((button) => button.addEventListener("click", () => { state.catalogStatusFilter = button.dataset.catalogStatus; render(); }));
  $$('[data-source-category]').forEach((button) => button.addEventListener("click", () => { state.sourceCategory = button.dataset.sourceCategory; render(); }));
  $$('[data-guide-follow]').forEach((button) => button.addEventListener("click", () => { const guide = state.guides.find((item) => item.id === button.dataset.guideFollow); if (!guide) return; const coverage = state.guideProgress[guide.id]?.coverage || {}; guide.coverage.resourceIds.forEach((id) => { if (!state.progress[id]) coverage[id] = "followed"; }); state.guideProgress[guide.id] = { status: "followed", coverage }; saveProgress(); render(); }));
  $$('[data-guide-confirm]').forEach((button) => button.addEventListener("click", () => { const guide = state.guides.find((item) => item.id === button.dataset.guideConfirm); if (!guide) return; const coverage = state.guideProgress[guide.id]?.coverage || {}; coverage[button.dataset.guideResource] = "confirmed"; state.guideProgress[guide.id] = { status: "followed", coverage }; state.progress[button.dataset.guideResource] = true; saveProgress(); renderKeepScroll(); }));
  $$('[data-guide-unconfirm]').forEach((button) => button.addEventListener("click", () => { delete state.progress[button.dataset.guideUnconfirm]; Object.values(state.guideProgress).forEach((guide) => { if (guide.coverage?.[button.dataset.guideUnconfirm] === "confirmed") guide.coverage[button.dataset.guideUnconfirm] = "followed"; }); saveProgress(); renderKeepScroll(); }));
}

function render() {
  const pkg = activePackage();
  if (!pkg) return;
  renderPackageList();
  renderHeader(pkg);
  const content = state.tab === "tasks" ? renderTasks(pkg) : state.tab === "materials" ? renderMaterials(pkg) : state.tab === "sources" ? renderSources() : state.tab === "catalog" ? renderCatalog() : renderOverview(pkg);
  $("#app-content").innerHTML = content;
  $$(".view-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === state.tab));
  const sourcesJump = $("#sources-jump");
  if (sourcesJump) {
    sourcesJump.disabled = state.tab === "sources";
    sourcesJump.classList.toggle("is-muted", state.tab === "sources");
  }
  bindContentEvents();
}

async function loadData() {
  const current = await fetch("data/current.json").then((response) => response.json());
  state.version = current.version;
  const base = `data/versions/${state.version}`;
  const packageFiles = ["new-player-big-pity", "new-player-max", "returning-big-pity", "returning-max"];
  const [meta, sources, ...packages] = await Promise.all([fetch(`${base}/meta.json`).then((response) => response.json()), fetch(`${base}/primogems.json`).then((response) => response.json()), ...packageFiles.map((id) => fetch(`${base}/packages/${id}.json`).then((response) => response.json()))]);
  state.meta = meta;
  state.sources = sources;
  state.packages = packages;
  state.sourceResources = new Map(Object.entries(await fetch("data/catalog/source-links.json").then((response) => response.json())));
  const characterIds = [...new Set(packages.flatMap((pkg) => pkg.materialPlan?.characterIds || []))];
  await Promise.all(characterIds.map(async (id) => { state.characters[id] = await fetch(`${base}/characters/${id}/materials.json`).then((response) => response.json()); }));
  try {
    state.geography = await fetch("data/catalog/regions.json").then((response) => response.json());
    const catalogIndex = await fetch("data/catalog/index.json").then((response) => response.json());
    const regions = Object.entries(catalogIndex.regions || {});
    const catalogGroups = await Promise.all(regions.flatMap(([regionId, region]) => (region.files || []).map(async (file) => {
      const items = await fetch(`data/catalog/one-time-resources/${regionId}/${file}.json`).then((response) => response.json());
      return items.map((item) => ({ ...item, _regionId: regionId, _regionName: region.name }));
    })));
    state.catalog = catalogGroups.flat();
    const evidenceGroups = await Promise.all(regions.flatMap(([regionId, region]) => (region.evidenceFiles || []).map(async (file) => {
      const evidence = await fetch(`data/catalog/evidence/${file}.json`).then((response) => response.json());
      return evidence.map((item) => ({ ...item, _regionId: regionId }));
    })));
    state.evidence = evidenceGroups.flat();
    const guideGroups = await Promise.all(regions.flatMap(([regionId, region]) => (region.guideFiles || []).map(async (file) => {
      const guides = await fetch(`data/catalog/guides/${regionId}/${file}.json`).then((response) => response.json());
      return guides.map((guide) => ({ ...guide, _regionId: regionId, _regionName: region.name }));
    })));
    state.guides = guideGroups.flat();
  } catch (error) {
    console.warn("一次性资源目录加载失败", error);
  }
  state.packageId = packages[0].id;
  loadProgress();
  loadProfile();
  renderCountdown();
  render();
}

document.addEventListener("click", (event) => { const tab = event.target.closest("[data-tab]"); if (tab) { state.tab = tab.dataset.tab; render(); } });
$("#sources-jump").addEventListener("click", () => { state.tab = "sources"; render(); });
$("#reset-progress").addEventListener("click", () => { if (!confirm("清空当前套餐的本地完成状态？")) return; state.progress = {}; state.guideProgress = {}; saveProgress(); render(); });

loadData().catch((error) => { console.error(error); $("#app-content").innerHTML = `<div class="empty-state">数据读取失败，请通过本地服务器打开此页面。<br /><small>${escapeHtml(error.message)}</small></div>`; });
