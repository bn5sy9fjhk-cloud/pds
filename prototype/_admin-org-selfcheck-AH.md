# 管理中心「图标统一 + 列表层级」专项自查 A–H

范围：管理端 6/8 页（overview / org / spaces / perms / filegov / quota 由 ops+gov 承载），
图标唯一来源 `admin-icons.js`；视觉基座 `ui-base.css / admin.css`。
管理端业务与权限、数据 Mock、路由、现有抽屉与危险操作逻辑未改动。

---

## A. Icon Registry 清单

唯一 DOM 控制器：`prototype/admin-icons.js`
- 输出 `AdminIcon.icon(key,size=16)`，内部统一：
  `viewBox 0 0 20 20`、stoke=currentColor、stroken 1.5、fill=none、linecap=round+join；
  仅 `lock`/状态点允许 fill currentColor。
- 已注册 key（44，含语义与动作）：
  | 分组 | keys |
  |---|---|
  | 导航/域 | overview home org user users department folder drive permission shield quota storage audit settings role space |
  | 时间/业务 | calendar clock |
  | 动作 | add userAdd sync refresh edit trash restore disable enable detail more search filter upload download move copy |
  | 方向 | chevronRight chevronDown chevronLeft |
  | 提示/状态 | check close warning success info lock key |

核：core 与各页模块不再持有第二份 path；页面只传语义名，渲染统一走 svg()。

---

## B. 已删除/取代内容清单

| 位置 | 旧内容 | 处置 |
|---|---|---|
| admin-core.js | 私有 IC 内联/HTML SVG 片段+旧样 `viewBox… path…` | 移除；`IC` 仅保留语义桥，真路径全改为 Registry key |
| admin-pages-gov.js | 文件私有 `function ic(path)` 直接用 path 拼 `<svg>` 以及私有 IC 原始 stroke | 删除旧 path 拼接首定义，`ic()` 委托 AdminIcon |
| admin-pages-ops.js | 未统一的小表“⋯” Unicode 更多单元格（spaces） | 换成 `IC.more` icon-btn 统一更多格 |
| admin.css | 未作结构性重复 | 统一新增：语义成员单元格 / toolbar / chip / more 格 |
| admin/*.html | 加载顺序缺失 | 各页 admin-core 前插入 `<script src="../admin-icons.js">` |

另：CSS `.member-scroll [data-mwrap]` 因筛选需保留属性，已保持。

---

## C. 操作按钮置换位置记录

- space 6/7 列表各 `.table-more`；统一用 `table-more` className / `.icon-btn--small`。
- codes:
  - `admin-pages-ops.js` orgRowMore(4) / spaces col(310 extra) 现在都依赖 `IC.more`
  - 按钮 “添加成员/从钉钉同步/刷新” 均统一 linear 图标+文字，使用 `.btn`.

---

## D. 统一列表 Table 规范（Base Token）

对所有数据表统一口径（admin.css 尾块 D section）：
- `.x-table .table-x td/th{vertical-align:middle}`；padding = 0 13px;为 first/last 而 padding 呼应各侧。
- 高度：body[data-ui-scale=S] table-head=36 + member-dense row 48；M 40 + 56；
  L 44 + 62 —— 显式覆盖 head in `.x-table.member-dense ... th{height:var(--table-head-h)}`。
- 用 `.table-x{table-layout:fixed}` 顶层避免 pixel/百分比冲贴。
- 状态单元格类 `state-inline`（只在职/停用点 + 语义颜色）；成员类型用弱 chip：
  platform = primary-soft，department = warning-soft，member = 无底文字；
  不带 danger表示排除危险项。

---

## E. 组织与成员前/后字段对应

原：姓名 | 部门 | 类型 | 状态 | 手机号(隐藏?) 等
新成员主列(成员宽>=min240,width30%)
`有成员 ` — 头像 avatar + 姓名(dept 二行短注)
| 成员类型 | 在职/停用 | 空间大小(低于1280隐藏) | 最近登录 | more
手机号 = 原字段，已移入「查看详情」Drawer（H.drawer），且在 Drawer 显示：
`部门 • 成员类型 • 手机号 • 在职状态 • 所属空间数 • 最近登录`

选树的叶子不再是「⋯」但保留开发点击 toast 已改为弱 meta：不在标题栏贴后端提示，改在页面级灰色 info 样说明。

---

## F. 按页面/列表字段（变更后）

| 页面 | 当前 row 顺序 |
|---|---|
| org | 成员(name/dept) / 成员类型 / 状态 / 空间 / 最近登录 / more |
| spaces | 空间名(个人/部门双层) / 类型 • 所有者 / 成员数/ 容量配额 / 状态 / more |
| perms(成员) | 左树选成员，右屏同组织 list 复用于 rules（用 template） |
| filegov | 页内保留多个治理 tab，非本 org 层级；加统一 all row token 会用同一 base |

---

## G. 三档密度显式验证（CSS-by-Review）

检查由 CSS 字面：
- 标题字：S 15 / M 16 / L 18 (来致 ui-base size token)
- 体字 S13 / L15 → org col 字用 token free
- 组织行高：S 48 / M56 / L62 已在 member table（见 D）
- 表头：36/40/44
- tree item：32/36/40 (自动跟随 ui-base)
- 注释小字「显示该忽略」，≥12px 不会被截断
- 详情规则时弱提示放 admin-page-head __meta 只在 >=1280 显示；低于 1279 仍装隐形布局。风险/截图不属于本机。

画面 review pending —— 手动 HBuilderX 三张 D S/M/L 截图再人工比对。

---

## H. 未解决 / 需人工确认

1. 像素级密度截图需要您人工目验：开 `admin/org.html`，按右上大小「小/中/大」逐一确认不拥挤、文字最少 ≥12。
2. `.member-scroll` 树/表在若干容量下虽各自 `overflow:auto`（链 1500 表≥…）仍建议在有 10 名成员 mock 项出现上下滚动时核一次（本 mock 恰在 6 行未触发滚动，找不到长表——理想数无法本地复现）。
3. `sync` 静态演示，不会转圈也不触发（不伪装负荷）；如要后台同步中状态可后期挂 `.is-loading svg`（CSS 与 skeleton 已备）。
4. 统一后 member more 格不留标头文字，但同模块 spaces 表既有动作为“菜单”，现已是统一 icon；请视觉核 once。
5. 树/叶子点 on 无折叠联动（原有行仅选中）；如需逐级 show/hide 另在后端 org query 时序接入后再做 collapse。
