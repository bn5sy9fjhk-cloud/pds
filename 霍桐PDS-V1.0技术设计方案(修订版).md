# 霍桐 PDS V1.0 技术设计方案（修订版）

> 定位：霍桐内部企业文件数据管理平台（仿阿里云 PDS / 企业网盘），服务公司内部员工。
> 技术主线：**uni-app 多端 + Spring Boot 单体模块化 + MySQL + Redis + 阿里云 OSS + 钉钉 + 独立 Preview Worker**。
> 产品重心：**CAD/3D 图纸在线看图、3D 轻量化渲染，以及工程源/二次开发脚本**的企业文件管理，而非通用文件上传网站。
> 第一阶段原则：不微服务化、不 K8s、不 Kafka/RabbitMQ；确属后续扩展均在正文内显式标注“非 MVP / 后续扩展”。
> 附：《原方案问题与修正记录》见文末（第二十七章）。

---

## 一、项目定位

- 范围：钉钉内全员登录 → 组织/部门共享 → 个人与部门空间 → 文件树管理 → OSS 直传 + 断点续传 → 配额 → 权限/回收站/版本 → CAD/3D 预览。
- 四类端/角色
  | 端 | 角色 | 关键能力 |
  |---|---|---|
  | 用户端 | 普通成员 | 访问「本人 + 被授权」的空间；文件 CRUD；上传下载；看件预览 |
  | 用户端 | 部门管理员 | 管理部门空间成员/权限/配额；回收站接管；可授予/回收 |
  | 管理端 | 平台管理员/超管 | 组织、全局空间、成员角色、配额全局、审计、系统运行、健康 |
- 明确边界（非目标）：不做对外开方/计费；不做图片识别副 SS（仅文件管理）。

---

## 二、总体架构

### 2.1 分层逻辑与数据流
```
客户端(uni-app 多端 → App/iOS-Android / 小程序 / H5 / PC)   管理端 + 用户端(同一后端)
        │ HTTPS / JSON
        ▼
Spring Boot 单体（模块化包，配置切分环境，单体可常驻一台或多台上线）
 Auth · Org · Drive · Permission · File(+Version) · Storage(OSS) · Upload · Recycle · Share · Preview · Audit · Search
        │                        │
        ├────────────────────────┴──────────────────────┐
   MySQL(业务/唯一约束/事务)    Redis(JWT无状态缓存/权限缓存/分布式锁/限流)    OSS(私有桶：source/、preview/、thumbnail/)
        ▲                       ▲                            ▲
        │ 查库/事务               │ 缓存/锁/去重                │ 临签(via STS/签名)
        └──── 定时任务(Scheduler + DB_task,见异步章) ──────────┘
                       独立 Preview Worker(容器/进程) —— OSS source→/preview
```

### 2.2 同步 / 异步 / 事务 / 最终一致 概览（详细见对应章节）
| 类型 | 范围 | 实现 |
|---|---|---|
| 同步读 | 列表/详情/下载/权限/配额读取 | 请求线程内，缓存+DB |
| 同步写（事务） | mkdir/rename/move/copy/delete(软删)/restore/purge/权限/配额/版本/complete 落盘 | DB 单服务内事务（见 21 章事务矩阵） |
| 客户端直传（非 HTTP 业务写事务） | 分片字节上传 | 拿到 uploadId 后前端直传 OSS；业务 DB 只记录任务与结果 |
| 异步（DB 任务表） | 钉钉同步/回收站清理/multipart 残片/hash 孤儿/预览任务与产物/失败重试 | Scheduler 轮询 `tb_async_job`/任务表 |
| 最终一致处 | OSS 已成功但 MySQL complete 失败/回滚；删除对象与 ref_count | 由 事务补偿 + DB 兜底扫描（后述） |

---

## 三、技术选型

| 层 | 选型 | MVP? | 说明 |
|---|---|---|---|
| 客户端 | uni-app (Vue3)（H5→PC拖动、小程序、App） | ✅ | 若做 App 强原生另行确认 uni-app x（开放点 D1） |
| 后端 | Spring Boot 3.x（Java17）+ Spring Security + MyBatis-Plus | ✅ | 单体模块化，按模块分包不拆服务 |
| DB | MySQL 8（utf8mb4） | ✅ | 强约束、事务 |
| 缓存/锁 | Redis 6+ | ✅ | 权码缓存/JWT黑名单/分布式锁/进度(非必要也缓存计数) |
| 文件 | 阿里云 OSS 私有 bucket | ✅ | source / preview / thumbnail 分 prefix 或分桶 |
| 身份 | 钉钉开放平台免登/扫码 + 本地账号 | ✅ | |
| 预览 | 自研 Preview Worker（Spring Scheduler 分发 / 独立进程 worker），外包 2D绘制内核/3D assimp，转换待选（D3） | ✅ | |
| 定时 | Spring Scheduler + DB 任务表（非石英/XXL），MVP 内置 | ✅ | 大规模实例再上分布式调度（非 MVP/后续扩展） |
| 检索 | MySQL `name_normalized` 前缀/LIKE + 字段过滤 | MVP |；海量用 OpenSearch（非 MVP/扩展，见 13 章） |
| Office/音视频预览 | OSS+/IMM(文档)/如需泛媒 IMM或外部（非 MVP/后续扩展，见 14.x） | 后续 | CAD/3D 为主 |
| 监控 | Spring Boot Actuator + 简单健康端点 | MVP | Prometheus/Grafana（非 MVP/后续扩展） |

---

## 四、组织与鉴权

### 4.1 钉钉账号与组织映射
- 唯一外部标识：钉钉 `unionId` 主键；`external_user_id` 二列冗余 tab，本地自维护 `user.id` 作为 JDBC 主统一引用，与钉钉解耦。
- 本地超管：首启由环境变量建管理员（`tb_user.is_super_admin=1`），可绑定或不绑定钉钉。
- 同步来源：拉取部门树+成员+离/入职事件回调。对象：
  `tb_dept(source=dingtalk/local, dingtalk_dept_id)` / `tb_user(external_id...)` / 关联表。
- 注意同步不得破坏本地空间授权：`dept_id` 停用只置 `status=disabled`，存量授权保留（同步只做 join 派生）。

### 4.2 登录流程与身份
身份层级：全局应用管理员角色(平台/部门 admin, 可进后台) ↔ 空间功能权限(第四/六章)。二者不叠加成一条。
- 平台管理员拥有全局用户/组织/全局空间与任意空间"管理可进入查看"(read only 全局默认可见空间列表+审计)。
- 钉钉 H5/App 免登 code / PC扫码 → `/api/auth/dingtalk` getuserinfo→ upsert→发 token。

### 4.3 JWT 二段式与登出（防缓存权限失效）
- JWT 载荷只存：`sub(userId)`、`jti`、`iat/exp`、`tokenVersion`（用于强制下线/账号禁用）、平台标记如 `isSuper`(仅防重复拉库，不做细权限判断, 权限一律重查)。**不携带每个空间的 ROLE/PSET**。
- 令牌版本：
  - `tb_user.token_version`（整型）。`tokenVersion!=tokens 表中当前值`或 已拉入黑名单 `jti/token_version`→ 拒绝。
  - 强制下线/改密/账号 disable → `token_version+=1` 即全端失效（无需等过期）。
  - 管理员改某成员某空间权限 → **不 invalidate 全局**，仅清该成员该空间的权码缓存 `perm:user:{uid}:drive:{did}`，下一次实时重新读库。
- 认证过滤器职责：解 JWT→查 `token_version`（Redis 缓存秒级）→得到 `userId`放入 context；每个写请求再由 `PermissionService` 带目标资源实际求权，不做“相信自己 token 内已带 Full”。

### 4.4 permission 快速判定通道（写实时）
读取路径：`PermissionService.resolve(userId, driveId)` → 缓存命中返回；miss → 查 MySQL(tb_drive_member + role 桶默认)算出 set，写缓存保留权(TTL)。之后任何涉及该 drive 的 API 用当前求解 set 判定（如需即时失效则清缓存）。

---

## 五、权限体系（在生产级明确）

### 5.1 三级实体视图
1. **平台/部门管理员标记**(tb_user_role / tb_drive_member.can_manage)：决定"谁能管理后台/某空间”。
2. **空间成员授权(tb_drive_member)[人×空间×权码 set, csv/bitmap]**：决定普通用户在某个空间的功能权限。
3. **角色桶**：仅作"预设置一次性填充"，不参与运行期叠加，减少歧义。

### 5.2 功能权码固化表（不同叠加语义已收敛避免歧义）
| 码 | 名称 | 用途 | 隐含 |
|---|---|---|---|
| DRIVE_READ | 浏览该空间/列目录 | 进列表 | - |
| FILE_DOWNLOAD | 下载 | GET signed dl | DRIVE_READ |
| FILE_PREVIEW | 预览(含在线看CAD/3D) | | DRIVE_READ |
| FILE_CREATE | 新建夹/上传 | 上传token/占位节点/mkdir | DRIVE_READ |
| FILE_WRITE | 改名/编辑内容/嵌套 | rename/cover/u-redo | FILE_CREATE |
| FILE_MOVE_COPY | 移动复制粘贴 | move/copy | DRIVE_READ+FILE_CREATE(目标) |
| FILE_DELETE | 删移回收站 | delete | DRIVE_READ |
| FILE_RESTORE | 恢复/接管回收站(与他空间管理) | restore/purge | DRIVE_READ + 空间管理 |
| MANAGE | 常被授予 部门管理员用(见5.4) | 成员/配额/接管 | 由层级A授予，独立位 */
owner/id 默认 FULL 且不可删(个体可被转让见下)

> 注意 FILE_CREATE 不代表有权覆盖既有文件内容。权限是最小可用：无 FILE_CREATE 不能上传与新件；虽上传需要 FILE_CREATE，但覆盖(< 同 drive 且已有同名) 需该 drive 有 `FILE_WRITE(cover)`。若无 FILE_WRITE 却命中同名且用户选择"仅新增不可覆盖"，后端在遇到已存在同名时应返回 NEED_COVER_PERM，不得静默覆盖。

### 5.3 授权约束硬规则（不靠前端）
- owner 不能删除/降权至 <DRIVE_READ；owner 不因管理员被移出（转让 drive 由新接口 `POST /admin/drives/{id}/transfer`，受平台管理员）。
- 平台管理员不能进入某空间时也同时拥有空间成员对该空间的读（他是 admin 权限，但如该空间隔离需求需要给空间成员 DRIVE_READ 授予——两者分开；默认 admin 可看列表看审计但空间文件需单独空间成员的 READ，避免 admin 意外读到全部 HR 隔离盘）。
- 能否操作“父目录+子目录任一 ACL”：改为层级 ACL 仅为可选的后续扩展(object_acl)；MVP 判定最小为“该用户在 drive 上权码 + target 驱动”，object_acl 命中时取它与 drive-level 的并＝可用集，反向做差集关闭。MVP 实现：目录对象若配置层级 ACL，读取该 ACL 与 drive 级求"最小集交集才能透过"。成本低可做（默认关闭）；海量目录必填避免递归从 drive 算叶子。

### 5.4 “部门管理员天然 FULL？” — 明确
- 部门管理员默认在**其负责的部门空间的 tb_drive_member** 中被赋 (含 MANAGE)。此为**显式记录**，由平台管理员一次性初始化，不是"因为是部门 admin 而魔法得到"。好处：某部门 admin 交接/解除不会误伤到其管理的所有空间。
- 平台管理员不可因 `is_super` 就自动获得"全空间空间文件 read"。要读某空间：本身须 DRIVE_READ 或临时：可临时以"接管"接口以审计身份查看列表(记录审计)，不建议常态。

### 5.5 防越权矩阵（管理层级）
- 谁可设管理员：**仅平台管理员**能给用户授部门管理员/平台管理员 role（最小提升），不能授超过自己等级的平台管理员；平台管理员间不可互授。
- 平台管理员不能添加/删除平台管理员(需超管/根账号) unless SYSTEM。
- 管理员改权限：只能管理**其具备 MANAGE 的空间**内的成员；不能把 MANAGE 授给权限高于其自身或 owner；不能给同级平台管理员改角色。
- 权限自身修改需审计+本身不可并发地降级为“不再 MANAGE 自己”(内部保护 owner)。

---

## 六、空间体系（Drive/配额/类型）

### 6.1 空间类型
- `FOLDER-DRIVE`（部门盘） owner=dept。
- `PERSONAL` owner=user。
- 每个 user 至多一个 personal；部门盘可多个(预留部门工作区)。
空间是权限与配额隔离单元；个人盘也可被管理员配置额外成员（共享）。

### 6.2 Quota（配额模型详规见 11 章）
- 每 drive 带配额：`quota_bytes`、`used_bytes`(已落成功)、`reserved_bytes`(在途未完成上传预占)。校验 `used+reserved<=quota`。
- 空间 owner(部门盘/个人)决定默认个人配额来源由管理员设置个人盘默认值，可在 drive 覆盖。

---

## 七、文件层面模型（逻辑文件 + 版本 + 物理哈希解耦 —— 修正原硬打平）

### 7.0 核心：把“逻辑对象/逻辑文件版本/物理 OSS 对象”三张表分离
原 tb_storage_object 直接把 oss_key、hash、etag 打在“文件节点”上，无法表达版本（覆盖只能破坏旧）。修订为：

```
tb_storage_object(FILE 型)        = 逻辑文件(名称/位置/展示态/当前版本指针)，不含 oss 物理信息
       │ 1──N
tb_file_version                   = 该文件某一次内容的版本（含 hash_id 引用、size、etag、change_note、is_current）
       │ N──1（引用）
tb_hash                           = OSS 上一个物理对象（去重单位，ref_count 由“版本的引用”计数）
```

- 目录(文件夹)也可以是 tb_storage_object(obj_type=FOLDER)。文件夹无版本。
- 只有 **tb_storage_object + obj_type=FILE** 有一个 `tb_file_version`；其“内容”实际都指向某 version。
- `ACTUAL`：新上传/OFFLINE在建立object等其后续版本。

三张关系（示例：同一内容共享一个物理对象）：
```
OBJ_A(File:"图纸v3.dwg", cur_ver_id=ver_#3)
   └─ VER#1(hash=H_x)         VER#3(current, hash=H_x)   ←两个版本引用同一 hash
        └─ tb_hash[id,x] oss_key=source/xx  ref_count=2  ←保证引用计数=引用版本个数
人 B 删除他的元素若删除 OBJ 会 decr 对应 version 引用多次→清扫规则见 12/15。
```

### 7.1 对象表主旨（字段最终见 16 章 DB）
新增关键从原方案拆正：
- 去掉直接在 obj 上 oss_key/hash/etag/size（这些迁往 version/hash 表）
- 新增：`cur_version_id`(FILE 时有)、`path`可选保留？
  不存冗余 path(string)于父表；只存 `parent_id`，「目录树」用 parent 递归查（分页/性能见 13）。
- 回收站在对象上加：`trash_parent_id, trash_name, trashed_by, trashed_at, trash_context`（见 12 章）。

### 7.2 版本表主旨（tb_file_version，新增，MVP 即启用，见 DB）
`version_no(1..n)、hash_id、oss_key 不存(由 hash), size、etag、is_current、change_note、created_by`
- 每次“内容真实变化并成功落盘”＝一个新 version（version_no 递增 from max+1），对应一次 hash 引用+1。
- 覆盖(`cover`)场景：若新内容 hash == 当前已存在某 version 的 hash → 不新插 version，仅 `is_current` 指向它? 需保留历史可恢复 — 若同名覆盖=新版本语义, 需产生新version_no记录 即便 hash 相同（历史 keep 也值变更note）。若相同hash但仅改note不新增会造成 当前指向(同 hash)旧版本而用户期望历史“原”在这之上——为保留完整历史，即使 hashesame 也会新插 version row（is_current 迁移到新行），旧行 is_current=0。物理引用计数对相同 hash 该版本+1 无碍（ref++）。

### 7.3 删除一个逻辑文件 ⇒ 物理(版本→hash)释放
- `tb_file_version` 引用 `tb_hash`。
- **软删(进回收站)**：所有它的 version 仍保留在 db(对象被藏至回收站)。版本计数仍由 `isCurrent+历史` 提供，回收站期间 `hash.ref_count` 不减（因为还在物理引用，不能删对象）。
- **彻底删除/purge(file)**：逐版本把“该版本是否属该 obj” —— 但不同对象可引用同一 hash。因此**不能按“对象没了就 hash.ref_count--×版本数”一次性减**而必须逐版本释放：
  `for v in obj.versions: decrHashRef(hash of v)`，之后把 obj 与该对象版本的引用标记删除(`deleted=1`)。若某 hash 仍有他人对象版本引用→不物理删；无引用进入 orphan 池(见章节15)。

---

## 八、文件版本 — 专项设计

已确立模型(7)之上，明确"覆盖 vs 自动改名"为用户可见策略：
| 操作 | 语义 | 触发 | 结果 |
|---|---|---|---|
| 上传新到空名 | 新增 | 普通 | 新 obj + version1 |
| 上传但目标存在同名且选“覆盖” | **上新版本** | fileName 同类且有 FILE_WRITE | 原 obj 不变，追加 version_no=N+1, is_current 切到新，保留历史 |
| 上传命中同名但选择“保留两者” | autoRenumber(`name(1)`) | 新 obj | 新 obj v1 |
| 覆盖又上传相同 hash（内容没变） | 仍产生 version_no，但 is 指向（历史相同内容多一条 note） | | 保留可读“我 此刻更新过它”，仍有 note |
| 右键“上传新版本到此文件/覆盖当前版本” | 语义如覆盖 | | version++ |
| 文件在线修改保存(如 CAD 有 VCS级版本库) | | | 依赖协作协议非MVP | 

历史能力/P接口：
- 遍历与列表 `GET /file/:id/versions`
- 恢复历史版本 → 新版本（把旧 version 内容 clone 为新版本 + note，或直接 cur 指到该 version? 为保留 also 历史链完整,建议“恢复”= 新建 version 指向目标 hash, note:"restore to x”，cur 切到它，O(引用++)，绝不会覆盖既有历史实体）
- 删除历史版本（可选, 需拥有者权限）→ 释放该 version 的 hash 引用；当前版本不得删。
- 审计含版本。

安全要点：所有“覆盖/新版本”写同一 obj 时须并发串行（该 obj 上加锁避免 version_no 重复，见同名并发展开第 21 与 10 节）。由于 version_no 唯一约束 `(object_id)` 且 version_no=max 需在同一事务对 obj 加 for update（见 10）。

---

## 九、上传下载

### 9.1 全类型上传节奏总图
```
小文件(<阈值, 默认 8MB)    → 单请求简单上传（走后端签 simple put 或 POST-V4Policy）
大/中(O≥8MB, <阈值内也分片安全) → OSS multipart 分片
超大 CAD：仍 multipart，每片可配(默认 5MB)、并发可配(e.g.3)
秒传: 前端算 hash(md5 或 crc) → /api/file/quick(幂等,idempotencyKey) → 若物理已存在直接走"登记版本"→ 返回(SUCCESS)
```

### 9.2 upload-token（关键握手，配额原子预占 + 防超卖）
```text
入参： driveId,parentId,fileName,sizeBytes,md5(可无), strategy(cover|new|ask), clientMd5(预), idempotencyKey, contentType
流程(事务1, PUT lock drive row FOR UPDATE)：
  1) 鉴权 File_CREATE(+如需 cover 则额外 FILE_WRITE)，并锁定配额([详见 11])：原子预占 reserved。
      校验 used+reserved+size<=quota 否则报 QUOTA_EXCEED；满足则   drive.reserved += size。
  2) 分配逻辑对象：
       - strategy=cover 且已存在同名(FILE): 不建新object(复用它)，锁定 obj 行(FOR UPDATE)→ 记录将在 complete 时追加版本。
       - 否则(新文件/存两者) 预创建 tb_storage_object(FILE,status=INIT) 挂 parent；parent为此且已有同名时不插(冲突走策略)。
       存入 tb_upload_task(状态INIT,记录归属 drive/object? 到同名,strategy,reservedBytes)
  3) OSS：InitiateMultipartUpload(仅需一次生成后续复用按 multipart)/ 或单签名用于简单件也可现持单policy。
  4) 返回 {taskId, ossKey, uploadId, partsInfo?:{partNumber...}, policy/sign…resumeSignatureAttlas_, reservedBytes}
幂等key: 同 uploadTaskIs 重复调用直接返回首任务而不是新建(状态 INIT→直接换 exp).
```

### 9.3 分片上传段（字节不经过 web 后端）
- 前端用 OSS Client(带 uploadId)或带直传签名单片 PUT。逐片得到 ETag（返回存下）。每完成若干片 → `PUT /api/file/upload/:taskId/sync`(内幂等 by requestId) 由后端写入 `etag_list_json` 且置 reserved==size 恒等（预留是满占，上传本身不扩大）。
- 配额原则：reserved 在 token 阶段就扣满 size（不是 bytesDone）。因从 INIT 即 intent 占位，防两个并发都把空间花在内容还只传一半；completed 时才放 — 但其实“满预留”会把 quota 一直占满直至完成，合理（用户发起即认为要占整 file）。若其取消→释放 reserved（详见补全）。

### 9.4 checkpoint 与续传（真正可断点）
- checkpoint 来源三路兜底：
  a) 前端每次片完成，本地持久化 partNumber 表到 localStorage 与其后置 Redis(cr set `uploadparts:{task}`)，并从后端 `/sync` 落 DB 部分(不全量)。
  b) 后端续传时 `ListParts(ossKey,uploadId)` 主动查询 OSS 已存在 partNumber 做校准，防本地丢失。
- 继续：`POST /api/file/upload/:taskId/resume`（自动核对 task 有效、STS 有效）→ 返回 OSS 已验证已传 partNumber 集合 → 前端只上传缺片。即使刷新页面/断电，task/persist 在 MySQL → 可在登录后任务面板查“我的任务”从残留继续。
- complete 幂等：接口对 task `SUCCESS/COMPLETING` 重复返回首个，另外通过 `tb_preview/unique_success`? — 有唯一键把 DB object→cur_version 落成原子。可加 `unique key (upload_finalized)`。

### 9.5 任务过期与 multipart 残片清理
- `tb_upload_task.expire_at`(据 STS有效期或配置)。
- Scheduler 每小时(可配) 扫 `INIT/UPLOADING/PAUSED/FAILED/COMPLETING`? 遇：expire_at 且未成功 → `AbortMultipartUpload` + 标记 task=EXPIRED / cancel,释放 reserved 并把预留数回滚(可含文件) → 清理。
- 单条 keep orphan: 无 upload 任务的 orphan parts(token 已发但要预防) 由 审计 & OSS 生命周期规则配 `prefix source/_parts/`? → 不便；改用幂等 keys + 每日扫描 bucket object with meta tag `x-oss-tagging=TaskId` 与 DB join 删除孤儿 —— wait，我们通常直接 task expire 就停掉。若 STS 泄露，oss 生命周期 bucket 规则对失之。已够。

### 9.6 失败/回滚
- 分发片完成后 complete 前失败：允许 retry 续传不回收(非 abort)。若用户主动取消=彻底中止→Abort multipart+释放 reserved+删除未完成的 INIT object（如未 cover 旧也建了 INIT object）。
- complete OSS OK 但写库失败：见第21 事务与补偿。OSS COMPLETE 完成后把 task→SUCCESS；若 DB 提交失败：数据对象在库里 status=INIT/PART，将由恢复 worker resolve（调用 complete 幂等重执行或按 ID 找 state）。

### 9.7 前端上传任务面板
同原计划：(排队/进度X.进度%/暂停/继续/重试/取消)。MVP 各端:
- H5/PC: 底栏+展开面板+全部继续。
- 手机(微信/钉钉小程序/App): 原生选文件后 entry panel, 同一套 resume。
- 拖拽(见原前端章节，H5)。
任务从 MySQL 拉（非 localStorage 权威），权限令牌由 resume 生成。

---

## 十、OSS 存储与安全（含 Policy）

- Bucket: 私有, 默认同桶用 `/source/<drive>/`、`/preview/`、`/thumbnail/` 前缀；敏感数据可独立(如有更高隔离域则分桶，非MVP)。
- 写前最小权限 RAM policy 形如：
```json
{
 "Version":"1",
 "Statement":[{"Effect":"Allow",
   "Action":["oss:PutObject","oss:InitiateMultipartUpload","oss:UploadPart","oss:CompleteMultipartUpload","oss:AbortMultipartUpload","oss:ListParts"],
   "Resource":["acs:oss:*:*:bucketX/source/drive{DID}/*"],
   "Condition":{"StringEquals":{"oss:ContentLength":...限小片大小范围内},
                 "StringLike":{"kms..."}}}}]
}
```
  严限定 bucket、key-prefix 到 `/source/` 当前 drive(使拿 STS 也无法向别的盘/／preview 写)、限内容长度<=配置上限、明文标明 content-type 白名单可选。只在极短有效期(STS 1-3min分段足够、多分段需每次 refresh 各片签) — 实际我们是每 task 多片可复用 sign by uploadId; 简单件单次 sign 短过期。
- 直传=浏览器把字节送到OSS，私钥永不到前端。
- 下载/预览/分享 URL 均为 `OSS signURL` 或 CDN+伪私有签名。
- STS RAM Role 与长期 AK 分离。

### URL 越权泄漏防护
- 下载单独对应带下载权用户请求下发签名(短 TTL)，不得从 /file/list 批量返回永签。
- Preview URL 亦短签；分享一条是独立 token 域(见分享章)不直接复用个人 session。
- （安全模型细节见 18 章；XSS/CSRF/CORS 等在多端章节处理。）
- 版本号安全：历史/当前下载走的 url 各自带 query `version=`

---

## 十一、配额模型（重点修正：reserved）

数据不变量：`drive_used + drive_reserved <= drive_quota`。

规则决议：
1. **upload-token 阶段原子预占(reserved)** → 在事务里 `SELECT ... FOR UPDATE` drive，`reserved := reserved + expectedSize`，对 expectedSize 即 sizeBytes。用行锁防并发超卖（先拿应占额度看余量足够，二者在一个锁临界节拍内完成 CAS）。
2. **complete 成功后**：事务内 `used += totalBytes; reserved -= totalBytes;`（对预留扣的是全量：完成前 reserved 已是 size，完成后 reserved→0、used→size）。若 cover 到同名，新版本 size 计入该类对象的占用（也 adding used size），旧版本若保留则它也在 used。其实覆盖的内容变更应为 `used += 新size - 旧cur size`? — 这里定义：
   空间 used = Σ size of 每个 active 对象的**当前版本 size**(不考虑 all 历史版本? 需与占策略并列)。
   决定：**used 统计 = Σ active(FILE) 的「当前生效内容 size」**（current version）。历史版本占用量另计 **version_storage_bytes** 更复杂。
   为避免内存量假，MVP 取保守定义：**used = Σ 所有 active 对象的全部版本的真实物理字节(入 ref 物理对象 sum ≥1)**（这样即使同 drive 两个文件引用同一 hash 也只计一次物理——不能重复计同hash入两次。）
   参照 de-dup：该 drive 计算 physical-used = Σ tb_hash.ref_count>0 mapped 且在那些 active对象上(不管跨版本)，因此 used_by_drive 与照引用的 per-drive footprint 近似。易实现：used 更新 = 每次“净新增物理(hash 在被此 drive 首次引用)时 +size" 与“净移除(最后释放在此drive)" 时-size*ref一次。
  （MVP 简单而够：对 cover **仅当新 hash 与 current 旧不同**时：used_crdelta=+newSize-oldCurObjSize；对回收站对象仍在 drive → 仍计入 used（由 purge 才减? 见12）。详细量化后实现笔记合并在 11.7）
3 reserve 预占，是为了在途大期间占 space 保证并发不超卖；complete 转 used 减少 reserved，因此某用户正在传大份时 reserved 高，多数是合理占位。但要放 reserved 不至于大到让并发拿空间阻塞——必要时 offset：在 upload-token 只预留 **min(size, hardCap_head)** 与配套，但那会带来超卖可能——MVP 采用 `保留 size（全量）`, 达成不超卖；在低配额盘有可能拒绝同时在传到 quota。这是可接受产品策略并可后续调整（非MVP调节）。
4. 秒传不需要新建 reserved（不触物理），但因秒传会立刻让 obj 版本引用已存在 hash —— 仅当 drive `used(含对该 hash 在该drive计算) + 本次无 net new`? 秒传如果该盘本已有同 hash 内容: no new physical → used 不加；若该盘没有但总仓库有(same new版本) 要 +size 且 ref 为该drive首次 → used+=。流程：quick 校验等同 upload-token 里"是否新引用此hash在 drive"决定是否预留.为避免二义,quick不做预占直接走 upload-token 同样的配额逻辑（call same reservation），但只建版本不传字节。
5. 覆盖旧版本：净新增 only 若新hash 非该 obj 当前引用的物理，相对 change 见上文净。历史版本累积(不并入下载占用)仍计 used? 见界定——**历史版本计入 used(物理真实)**并计入清理(历史也有 ref)。这是为了能长时间保留历史但消耗空间显性。若太占可配置保留策略并关闭历史开销(非MVP可设 cap 版本数)。
6. 删除→回收站期间**仍计 used**(对象及其版本还在, 待 purge)。restore 不变量保持。
7. purge（永久删）= 释放物理, 走 ref_count 递减逻辑后若为该 drive 最后引用则该 drive 物理减 size×ref。清理版本历史和 preview 产物关联（见 12/15）。
8. 版本保留：默认开（数据安全），建议建议给"占用可回溯"，配额由 #5 显性计。

预占需显示 UI 层"已用 (含上传中)”。

### 配额并发表格（见 21.4 Drive 行锁 + 事务）
对外一致性：using row lock @drive for the reservation/commit/release/quick/purge 同锁释放资源 & its child objects (其 drive 行) — purgen has impact for used 以释放空 for 其它。

其它细节：超配额占多数盘体上 failure 由接口 QUOTA 明确回给客户端→面板显 "空间不足(含在途保留)"。

---

## 十二、回收站

### 12.1 对象上回收站字段
```
trash_parent_id(=object原parent)、trash_name(=原名，改名恢复用原对象自身name可能已被新占同名, 但它 name 是自身保留不变? 设计: 隐藏删除后可重名。故已主动置 trash_name 即 rename)但为了方便恢复需求为：把节点从 parent 剥离但保留它本身 name; 增加 trash_prev_parent_id 与 trash_name(=它原)一致性：进回收站 DB 仅：status=TRASHED、trash_at、trash_by、trash_prev_parent_id（原 name 不变仍 当前 parent 清除? parent 置0或用父指针);为恢复准确性新增 trash_prev_parent_id + trash_orig_name(snapshot 原名在必要时 re-number).当原位置同名新文件出现,恢复仅 rename。
```
### 12.2 策略
- 仅 DRIVE_READ 即可把**自己有权 DELETE 的** 对象移入回收站。
- 谁可见/接管回收站：有 FILE_RESTORE&MH?(非owner管理能接管其对象) 可见同 drive 回收站并可 restore/purge。
- 恢复校验：需要目标目录 **FILE_CREATE(新建)** + 目标目录 DRIVE_READ（读入格、判断 name）。owner 与 MANAGE 都有。
- 恢复路径决策：
   原父目录存在(parent_id 仍有效且 status=ACTIVE not trash) → 恢复到该父；
   原父已被删/不存在(对象被随父被删该扔回收站连同 whole init) → 目标=空间根；
   恢复时有同名 → rename to `原名(1)`；(重复循环递增)若多次仍撞(极端并发) 用系统加括号与最大编号，用第10章同名 auto 定例保证不重复。
  需要还原的对象若被整目录入回收(父目录也 trashed)恢复其中子对象前应该先恢复父链(POST 递 归)。 — MVP 收起”恢复子树“：用户可在回收站对文件夹执行整文件夹恢复，并把内在子一并递归回（事务+内部恢复）。不支持"只恢复某子级而父仍回收"处理先恢复祖先（相对简单实现整夹）。
- purge 永久删除文件：对子对象全部也 purge? 当 purge 一个文件夹应递归把整体（若也含子) 一并物理删除并先后 collect 引用。对文件夹回收站 purge = 递归（需 worker /或事务内批量删除全部其子 by drive 能,量大拆异步(15.4)。MVP同步完成至 100k，之上走 job 白异步（expand）。

### 12.3 清理策略(90日)
- Scheduler 每夜清 `trash_at+retention<=now` → 对每条 走 purge 逻辑（释放 ref_count/物理/perview 产物标记删除）→ 完成后对象 metadata purge。
- 删除不被 flush: purge 时候把 preview 产物标记 purge(而不是立即 OSS DEL)：交由 preview_cleanup worker，也防用户极罕见恢复? Purge 后不可恢复，若 purge则把产物清理置 hardDeletePhase→worker removes /preview||/thumb。

### 12.4 delete 与原版本/物理
回收站 move = 不碰 ref_count（历史&当前版本引用保留），仅对象状态 TRASHED。purge → 见 §7.3 逐版本 ref--。

---

## 十三、搜索

### 13.1 MVP(MySQL)
- 保留列全部利于检索，落地表索引：
   - `idx_obj_drive_parent(drive_id,parent_id)`
   - `idx_obj_name_txt` 上 `name_normalized` 后缀可用，做前缀 `LIKE 'kw%'` 且 `# INDEX(UTF8MB4_LOWER)` — MySQL 无 gin，MVP 用 `prefix( name_normalized, 'kw%')`? MySQL 只能用前导 LIKE index scan；为文件名含词用 `col LIKE '%kw%'` 在 parent 与 drive filter 下 allowed 走索引扫范围。
  更稳妥 MVP：**drive范围+对象名前缀**提供主要命中；含"子串"放在”搜索框+过滤"，走 `fulltext` (MySQL5.7 fulltext ngram 可于 中文 支持要用 ngram) 还是 OpenSearch。若需要件名含中文与前缀：通过 pivot 建立一个 微 `tb_search_tag`（在下一可扩）？过度。MVP 定：
   **对文件名：`(drive,parent)` filter + `LIKE '前' prefix`; 对"全局搜(不限盘/父)": 先 `parent 任 + name 前缀` index，交由 (drive?不能用)，可用对全局 `name_normalized LIKE` 不做前缀 in huge 会慢 → 一个受检用户可搜范围集合 userPosible 由 permission drive 列表，然后**多个 drive 内各做索引前缀**（=对授范围 drive 循环）。限制量足够即可。
子串/中文分词搜索（可跨 drive）→ 标记 后续就上 OpenSearch（非MVP/扩展）。
- 参数：`q`,`driveId`(可多),`type(fileExt/const),`itemType(FILE/FOLDER)`,`mtime_before/after`,`size__`、`creator`、`page/keyset`≥父级关键字。
### 13.2 后续(OpenSearch)
- 由 MySQL 数据写入索引 topic; 需保留/入indexed fields: id,parent_id,drive_id,name,name_normalized,file_ext,obj_type,created_by,created_at,updated_at,size_bytes,deleted/trash 状态,version_id & is-active → 索引用。MVP 时即先把上述列留在 obj 表（不要删 id/cursor），字段方便后续。
- （非MVP mention without design deep；不新增复杂 infra MVP。）

### 13.3 ID 全局与分批
search/with recycle list 用 keyset 页面即可。

---

## 十四、CAD/3D 预览系统（不改主定位,补强可靠性）

### 14.1 类型→预览映射表(MVP支持/主)
| 扩展 | 处理 | 特征 | MVP |
|---|---|---|---|
| dwg/dxf | Worker转SVG/PNG+图元 | 矢量缩放/图层 | ✅主干 |
| 3ds/obj/fbx/stl/stp/gltf | Worker → glb(Draco)+缩略 | WebGL 看件 | ✅主干 |
| 工程源/脚本(prj/lsp/bas/宏/文本/code…) | 文本只读查看 | 缩读+可选水印 | ✅ |
| png/jpg/svg/tiff/gif | 原生临签直显 | 图 | ✅ |
| pdf | pdf.js sourceor直接，无需 worker | | ✅ |
| doc/xlsx/ppt & mp4/mov(如果混放) | IMM文档→pdf / 或非核心泛媒 | 非主线 | 非MVP(mark) |
| 视频 | OSS×MPS/HLS | 非主线 | 非MVP |
图 → thumbnail 统一生成 可 worker。

### 14.2 可靠性(status)及其修正
`tb_preview_job`(由 object+version 触发，主键幂等)
status: QUEUED / PROCESSING / SUCCESS / FAILED / CANCELLED / EXPIRED
字段：retry_count,max_retry,next_retry_at,worker_id,started_at,finished_at,heartbeat_at,result_json,error_msg

**heartbeat/死机修复**：worker 进程begin时 `heartbeat_at=now,&state PROCESSING`，且每个阶段吐心跳；调度器 job每 x 秒检查 `PROCESSING 且 (now-heartbeat_at)>timeout` → 判定假死→ 重置 QUEUED(worker_id 置空,retry如果 permit) → 重新派发。让重试上限(默认3)每次 max。超过 max→ status=FAILED 并记。

**重新生成时序**：
- object 新建时等 first view on file 主动触发(preview-on-demand)，或上传完成若类型可预设在空闲触发(可选)；MVP 用 首次请求 preview-info 且无产物→ 创建任务异步返回 processing;完成后 client 轮次/或 WS 通知（MVP轮询）。
- **上传新版本(cover)** 触发旧 preview 失效并使任务 reset（新 source→ 新preview）———因为产物/缩略对应 source 实体=版本，所以 preview key 用 `preview/<drive>/<object>/<versionNo>/*`。每次 current 的 cur_version 变化，要么删除旧cur产物要么让 /preview/:obj/{version} 存多份做多版本回看。MVP 只给当前版本：若 new current produced → produce /preview current；历史 preview 需恢复需要才做(非MVP)。

### 14.3 产物生命周期关联（source/preview/thumb 分开）
- 产物跟随「对应的 versionNo」: OSS key 结构
  `/source/{driveId}/{objectId}/{versionNo}/{file}`(真正的数据源，只被 download/quic / source)
  实际源上传物理位于 source；但 de-dup 允许不同 obj/ver 共享同一 source？设计：文件系统抽象作为去重在 hash 层，而 preview 依赖『源实体是否存在』并须独立。
  为不破坏去重且支持 preview按版本：我们 **preview 引用「hash 实体」(能物理同对象去重)；若 preview 产物命中，则产物命名用 hash 作为 identity 使其在跨 obj 共享生成一次**
  Key:
   - source : `/s/{hashHex}` (供下载/去重, 无 drive 前缀;其所有在岗/历史 obj 都可能有)
   - preview: `/p/v/{hashHex}/*`
   - thumb: `/t/{hashHex}`
  好处: 覆盖同内容无需重新生成; ref 回收可孤儿/散清理。缺点: source 无 drive 前缀便于清理(拥有最后引用才需要删 source;孤儿清扫 worker 在 hash ref=0 删除 `/s`,`/p`,`/t`)。管理端更想 human trace? level tag header+OSS tags(meta)存 driveId等审计。
   决定MVP：.preview 和 thumb 以 **hash identity**存储; source 同上各自, key includes hash。
  (若无去重 单文件专属则 source key = /s/{drive}/{object}/{ver} — 但那破坏秒传/去重复用跨盘并，-仍是 hash key为纲但加人类前缀 `/s/../{h}`。) 最终：**source `/s/d{DID}up/hext` 人类刻，preview 对应 `/p/{hhex}`** — 由于秒传跨盘重用则源位于首个写它的盘前缀下即可(合理)。
- preview 清理：对某 hash 无版本引用(orphan) → 一并把 /s, /p, /t 删(由清扫worker/若 preview_ref=0)。删除 source not preview？若 hash 无 obj。但对『删除preview但source其它 obj 仍版本引用』我们需要**保留 preview 只在没有引用时删** —— preview 以 hash 计其实与 hash.ref>0 同存亡更天然：当 ref_count→0 purge; 未到0即使删当前也不该 remove。/t 可完全利 - 可省(缩略跨文件共享直接 hash) MVP直接。
- 当某 obj 被永久删除、历version无引用、当时若该 hash 已 orphan 则清扫 worker：orphan detection page → (清理 hash 表空 & no/object ver ref) → rm。

### 14.4 CAS / 2D 细节（沿用修订内容不变，注明 in-place 优化；worker 以版本触发）

---

## 十五、异步任务体系（DB 任务表，不用 MQ）

MVP：**一张统一任务表** `tb_async_job`(id,type,payload,status(QUEUED/RUNNING/SUCCESS/FAIL),retry, next_run, priority, run_lock(乐观))由 Spring Scheduler 多实例并发抢(select for update skip locked)，兼容单机/多实例演进（非MVP上 xxl/拆分表）。
也可分**专项表**但保持一致规约选择:
- 通用异步(主用 tb_async_job)：
   `recyling_scan_*`, `purge_expired`, `cleal_multipart`, `hash_orphan_clean`, preview任务(preview自身走 tb_preview_job)，失败 upload finalize, org_sync 等。
- 除 preview用独立 tb_preview_job（其有 worker隔离/heartbeat 语义独立）外，都可走 tb_async_job。
- 未来拆表/MQ：“非本阶段(MVP)：当单库扫描慢或频度高;说明即可不执行”

调度与抢：`@Scheduled(cron)` loop query queue 每 tick 拿一批(N) `… WHERE next_run<=now … NOWAIT`?没有Oracle; 用 `for update skip locked` 到批。每 job worker 用 optimistic。retry 推进 next_retry_at=now+backoff`.

任务矩阵（rephase 14 preview queue separate as own mini-table due heartbeat; others asyncjob）见 table。

---

---

## 十六、数据库最终设计（可直接落 DDL）

> 约定：主键 bigint; `deleted` 逻辑删除；时间 `datetime(3)`/UTC；金额/大小用 `bigint`(字节)；非空 unless `NULL`；均由框架审计 created_by/updated_by/created_at/updated_at。下以「字段 | 类型 | 空 | 默认 | 说明」梳理，完整 DDL 另附 `schema.sql`（M0）。
> 唯一键是并发正确性核心，见索引/唯一列。

### 16.1 组织域
**tb_dept**
| 字段 | 类型 | 空 | 默认 | 说明 |
|---|---|---|---|---|
| id | bigint | n | 自增 | |
| parent_id | bigint | n | 0 | 根=0 |
| name | varchar(128) | n | | |
| source | varchar(16) | n | local | dingtalk/local |
| dingtalk_dept_id | varchar(64) | y | | 同步映射 |
| sort | int | n | 0 | |
| status | tinyint | n | 1 | 1启用/0停用 |
| deleted | tinyint | n | 0 | |
索引: (parent_id), (dingtalk_dept_id)。唯一: source='dingtalk' 时 dingtalk_dept_id 唯一(部分唯一视引擎)。
需求决定不需要跑 it.

**tb_user**
| id | bigint | n | | |
| external_id | varchar(96) | y | | dingtalk unionId |
| external_user_id | varchar(96) | y | | dingtalk userId(加密) 冗余 |
| name | varchar(128) | n | | 显示名 |
| mobile | varchar(32) | y | | |
| email | varchar(128) | y | | |
| avatar | varchar(512) | y | | |
| status | tinyint | n | 1 | 1正常/0禁用 |
| is_super_admin | tinyint | n | 0 | 平台超级管理员(1) |
| is_dept_admin(resolved?) | 见 tb_user_role | | | 不落 |
| token_version | int | n | 0 | JWT 全端失效桶 |
| last_login_at | datetime | y | | |
| deleted | tinyint | n | 0 | |
索引 (external_id),(is_super_admin)。唯一 (external_id where not null)。

**tb_user_dept**
id,user_id,dept_id,is_primary(dept 主),deleted 索引(user,dept)。唯一 (user_id,dept_id)。
（one user 可在多部门，主部门标识；s魂同步。）

**tb_role**
id,code,UNIQUE(name)，内置：`SUPER_ADMIN`,`DEPT_ADMIN`,`MEMBER`,`ORG_ADMIN`(可选)。

**tb_user_role**
id,user_id,role_id,scope_dept_id(NULL=全局),resource(granted_by),effective_end? N。
unique (user_id,role_id,scope_dept_id) 未删。

### 16.2 空间
**tb_drive**
| id | bigint | n | | |
| drive_type | varchar(16) | n | | PERSONAL/DEPT |
| owner_user_id | bigint | y | | personal owner |
| owner_dept_id | bigint | y | | dept drive owner |
| name | varchar(128) | n | | |
| status | tinyint | n | 1 | 启用/停用(停用后拒增写) |
| quota_bytes | bigint | n | 0 | 配额(0=默认/跟组织)默 profile |
| used_bytes | bigint | n | 0 | 物理需 |
| reserved_bytes | bigint | n | 0 | 在途预留 |
| trash_enabled | tinyint | n | 1 | |
| deleted | tinyint | n | 0 | |
索引 (owner_user_id),(owner_dept_id)。

**tb_drive_member**（空间成员+权码；MVP 无目录 ACL 也可 only this）
| id | bigint | n | | |
| drive_id | bigint | n | | |
| user_id | bigint | n | | |
| perms | varchar(255) | n | '' | CSV:VIEW/FILE_*；FULL 便捷符(展开存) |
| is_owner | tinyint | n | 0 | |
| can_manage | tinyint | n | 0 | 部门管理员=本空间管理 |
| granted_by | bigint | n | | |
| granted_at | datetime | y | | |
| deleted | tinyint | n | 0 | |
唯一: UNIQUE(drive_id,user_id,deleted_scope) —— MySQL 支持唯一(drive,user) 当 delete=0,用部分由可配触发器/generated status_scope 列; DDL 里我建 login `status_scope`=if(deleted=0,id,null)? 最简可靠：加 **UNIQUE(drive_id,user_id,is_active_member)**，其中 is_active_member 用 0/存 active? 两个均 1 no; 
实际采用：删除用物理软删自带的 `deleted`，唯一键带 deleted 会重复——推荐：**不真正 DELETE，改行 update perms='' can_manage=0 is_active=0** 保留供历史/回滚。判定唯一（drive_id,user_id）单活由字段 `active`。为 DB 简单：唯一(unk…) PK 无关。
  (注：参考，唯一(D=,U=)不被拒; 同盘同人仅 1 行 active+历史行屏蔽)

### 16.3 文件 / 哈希 / 版本 / 上传 / ACL / 回收站 / 分享
**tb_storage_object**（逻辑节点=文件或文件夹）
| id | bigint | n | | |
| drive_id | bigint | n | | |
| parent_id | bigint | n | 0 | |
| obj_type | varchar(8) | n | | FOLDER/FILE |
| name | varchar(255) | n | | 展示名 |
| name_normalized | varchar(255) | n | | lower/trim 判重 |
| cur_version_id | bigint | y | | FILE: current tb_file_version.id |
| created_by | bigint | n | | |
| updated_by | bigint | y | | |
| status | varchar(8) | n | ACTIVE | ACTIVE/TRASHED/INIT |
| trash_prev_parent_id | bigint | y | | 进回收前 parent(恢复用) |
| trashed_by | bigint | y | | |
| trashed_at | datetime | y | | |
| purge_at(如非实时) | datetime | y | | purge 完成 |
| deleted/tomb | tinyint | n | 0 | 硬删后 purge rows =>可物理删除记录 |
索引: idx(drive,parent), idx(parent), idx(name_normalized,drive)。
唯一性约束—同名并发：表上做 **(drive_id,parent_id,name_normalized,status_scope)**, 引入 generated `st`（active=1/trash=0/by) 通过? 
落 DDL：`status_tag TINYINT AS (IF(status='ACTIVE',1,0)) STORED` then `UNIQUE(drive_id,parent_id,name_normalized,status_tag)`(但 MySQL 允许 unique 含 NULL=> 可行多条) => 此创造让 ACTIVE 同名互相禁止，trashed 不参与。(可 null 允许回收站重名)。注意 inactive多行也要 NAME 不冲突因为只对 active 块加锁，但我们恢复会自动编号防冲突。**用该组合 = 数据库级铁窗**。

**tb_file_version**
| id | bigint | n | | |
| object_id | bigint | n | | 所属文件 |
| version_no | int | n | | 1..N 递增 per object |
| hash_id | bigint | n | | 引用 tb_hash |
| size_bytes | bigint | n | 0 | |
| etag | varchar(64) | y | | |
| change_note | varchar(255) | y | | |
| created_by | bigint | n | | |
| is_current | tinyint | n | 0 | 该 obj 当前 |
| deleted | tinyint | n | 0 | |
唯一: (object_id, deleted_status_scope?), (object_id,version_no) 组合唯一（未删）。is_current semis  唯一索引 only 1 active current where deleted=0 由逻辑保证可伴 UNIQUE(object_id,is_active_scope)。
从哈希：所有版本都引用 hash。

**tb_hash**（物理对象去重中心）
| id | bigint | n | | |
| hash_value | varchar(64) | n | | hex md5 或 sha1/xxhash 择 |
| hash_algorithm | varchar(8) | n | md5 | 预留 |
| size_bytes | bigint | n | | 物理 size |
| oss_key | varchar(512) | n | | `/s/...` 唯一物理 key |
| ref_count | int | n | 0 | 由被引用的 active version +(可被某非当前历史)计数 |
| status | varchar(8) | n | ACTIVE | ACTIVE/ORPHAN/清理中 |
| last_unref_at | datetime | y | | 参照计数归零时间(清扫阈值) |
| created_at | datetime | n | | |
索引: UNIQUE(hash_value,size_bytes)【同一 content+size 视为同一物理】,—细粒度: 同 size+binary content = one. evt. hash_value unique 就够了(如果冲突极小 hash_collision md5?) 加 hash_algorithm 复合。
oss: 同一 hash 不重复 upload; 由 release 归。

**tb_upload_task**
| id | unique | requestId(幂等UUID) | | 幂等 |
| user_id | | |
| drive_id | | parent_id |
| object_id | y | 预建 object |
| cover_target_object_id | y | 若覆盖 |
| file_name | file_size | size_bytes |
| md5 (precheck) |
| hash |算法 | 
| oss_key | y 由 hash 暂? /s/<taskDerived>? 物理 key 只有 hash 已知才固。若 multipart 未 md5? upload 分片 md5 / etag 做完可再算? 定义：切分前得到 md5，建立 hashkey;但 multipart 的 etag≠md5。因此：
  简单的物理 identity 规则：大文件也用「完成后对对象 oss md5 或我们只有 single ETag=?」->保留见下方冲突：
我们发现 去重 与 multipart 的组合需明确：
   - 我们先 md5 precheck(小/普通可)；若 quick 命中则 ref. 
   - 分片大通常不重复,可仍建 hash yet md5 hash 难直达。可以:multipart 中 os hash 用 统一算法 直接由用户端边碎边算 sha256/md5 流式得出最终——然后 complete 后校验即 get hash 后 ref&insert index 键 = contentHash.
  所以 hash 识别只用该推导出的 content hash (不依赖 etag)；etag 仅版本校验。
| total_parts, uploaded_parts |
| status(见状态机) |
| sizeRES | 
| progress(hundred) |
| upload_id | | OSS |
| etag_list_json | text | | 已传片 |
| expire_at | |
| finished_cur_version_id |
| created/updated |
索引 (user_id,status),(status); UNIQUE(idempotency_key)/task.
**由于唯一 constraint**: uniq `upload_task_once`(idempotency_key)。

（回收/清理时若 multipart 未 complete 的 abort 清扫需有周期而原子：用 state 机转移，见状态机。）
注：s small非分片可复用简单upload semantics 把同一 task 最小参数化(一个 task 支持 simple put，status 仍完整)。

**tb_object_acl**（可选目录级；MVP仅预留）
drive_id,object_id(文件夹),target_type/DEPT|USER,target_id,permission(bit 简档),created...
唯一 (object,target_type,target_id)。

**tb_share**（分享，MVP 仅内/链接）
| id | | |
| share_type | org(成员直达) | link |
| drive_id/object_id | | |
| target_user_id 或 share 链接 token | | |
| perm_code(简化 VIEW+DOWNLOAD/+) | 
| expire_at | status | password(link) |
| url_token | 随机 | revoke token |
| created_by deleted |
审计/收撤:
索引 (url_token),(object_id)。

### 16.4 审计 tb_audit_log
见 19 章字段(入库列全)。分表滚动：VIP 保留，后期分区(非MVP)。

### 16.5 预览 tb_preview_job / tn 产物引用? no:
| id,object_id?,drive, —preview 绑定 hash
| hash_id | | preview-targeted hash |
| job_type | CAD2D/3D/THUMB/TXT/PDF(v看) |
| status (QUEUED/...) |
| worker_id | worker 心跳 |
| heartbeat_at,started_at,finished_at |
| retry_count,max_retry(默认3),next_retry_at |
| result_json(产出 /p key) |
| source_key(不必存,取 hash) error_msg created/updated |
索引(has_job uniq: hash_id+job_type where not terminal)

### 16.6 系统
**tb_storage_config**「key,props(json)/enabled」同前,含 keys(oss region/bucket/rolearn/endpoint, dingtalk appkey/secret/agentId, 阈值 upload.partsize/ concurrency, 回收站保留天数, preview worker 心跳超时等）。
**tb_async_job**：id,type,payload(job_type...)、status(QUEUED/RUNNING/SUCCESS/FAIL)、gmt retry, next_run, max_retry, leader_lock。
     task own: recytclean/清multipart/organ deta/cleanup orphan hash 等。
**tb_sys_counter**用于配额计算兜?不需(以 drive.used 值) + history node。
**tb_app_session** 可选(MVP optional to record dingtalk? OA login 存钉钉 statNot needed)非核心可省。

SQL 完整文件：仓库 `/sql/schema.sql` + `/sql/seed.sql`(角色/内置 drive 配额)。
建索引名称规范化。

All above 也在 21 also note transaction matrix.
DDL 落实在 M0 产出，含上述 uniq & indexes 以免并发隐患。

---

## 十七、API 设计（可直接开发；含幂等/事务标注）

> 约定：统一前缀 `/api`；鉴权 Bearer JWT。字段 `reqId`(全局请求审计)。写接口建议客户端带 `X-Idempotency-Key`，见列。返回 `{code,message,data}`；分页 Keyset：`GET 列表?cursor=&limit=` 返回 `nextCursor`。
> 事务列：1=单服务 DB 事务；L=需行锁/Redis 锁；A=带 OSS 异步+补偿。幂等机制：K=客户端 idempotencyKey(UQ)；S=状态机；N=天然确定性。

### 17.1 认证/组织
| Method | Path | 权限 | 幂等 | 事务 | 说明 |
|---|---|---|---|---|---|
| POST | /api/auth/dingtalk | 免登code | N | 1 | 登录，返回 JWT+refresh |
| POST | /api/auth/refresh | token | N | - | 换发，验 token_version |
| POST | /api/auth/logout | 登录 | S | 1 | token_version++(全端)或按 jti |
| GET | /api/me | 登录 | N | - | 当前 info+可见空间+耗配 |
| GET | /api/me/perms?driveId= | 登录 | N | - | 目标空间权码+isOwner/manage |
| POST | /api/admin/org/sync | 平台admin | S | A | 触发钉钉同步(走异步) |
| GET | /api/admin/depts/tree | admin | N | - | Keyset 不强 |

### 17.2 空间/成员
| POST | /api/admin/drives | admin | S(建盘) | 1+L | 建个人/部门盘+配额；owner 初始化成员 |
| PUT | /api/admin/drives/{id} | MANAGE | N | 1 | 名称/配额/停区 |
| GET | /api/drives | 登录 | N | - | 我的可见盘 |
| GET | /api/admin/drives/{id}/members | MANAGE | N | - | |
| PUT | /api/admin/drives/{id}/members/{uid}/perms | MANAGE | N | 1 | 覆盖权码；校验层级(5.5) |
| PUT | /api/admin/drives/{id}/members/{uid}/manage | admin/MANAGE | N | 1 |；清 owner/member 对应缓存 |
| POST | /api/admin/drives/{id}/transfer | admin | K | 1 | 转让 owner(原 owner 校验在事务) |
| DELETE | /api/admin/drives/{id}/members/{uid} | MANAGE | S | 1 | owner 不可被删/降<READ；更新缓存 |

### 17.3 文件（列表/创建）
| GET | /api/file/list | DRIVE_READ | N | - | `?drive&parent&sort&filter&cursor&limit`(Keyset,见13) 不递归 |
| POST | /api/file/mkdir | FILE_CREATE | K | 1+L | name冲突见6.0；同夹锁 |
| PUT | /api/file/rename | FILE_WRITE+ | K | 1+L | 同夹锁避免撞 |
| POST | /api/file/move | 源DRIVE_READ+FILE_MOVE; 目标行 FILE_CREATE(insert in target) | K | 1+L | 目标锁+cycle检查 |
| POST | /api/file/copy | 读源DRIVE_READ；重建 target | K(copy新object) | 1+L | inner |
| POST | /api/file/delete | FILE_DELETE | K | 1(+L purge) | 进回收（软删，不碰 ref） |
| POST | /api/file/versions/:id/restore | FILE_RESTORE | K | 1+L | registry（见8）；引用- |
| GET | /api/file/{id}/versions | DRIVE_READ | N | - | 遍历 |
| DELETE | /api/file/versions/{id} | owner/MANAGE | K | 1+L | 删除历史版本；当前禁；引用-- |

### 17.4 上传（detail/闭环）
| Method | Path | 权限 | 幂等 | 事务 | 说明 |
|---|---|---|---|---|---|
| POST | /api/file/upload-token | FILE_CREATE(cover 需 FILE_WRITE) | K=req(UQ) | **1+L(drive)** | 配额预占reserved；InitiateMultipart；返回 task |
| POST | /api/file/quick | FILE_CREATE | K | 1+L(drive)+锁obj | md5命中→建version引用；本 drive 物理净增核算 |
| PUT | /api/file/upload/{taskId}/sync | task owner | S(节流) | 1 | 存片表 & progress |
| POST | /api/file/upload/{taskId}/resume | task owner | N | 1 | ListParts校准→补缺目录 |
| POST | /api/file/upload/{taskId}/pause | owner | S | 1+L | paused；Abort 时机见过期 |
| POST | /api/file/upload/{taskId}/cancel | owner | S | 1+L(drive) | Abort+释放reserved+清INIT object |
| POST | /api/file/upload/{taskId}/complete | owner | S+K on req | **1+L(drive)+L(obj)/最终** | 见下(幂等正文)：CompleteOSS→落版本→used/reserved转换→删除preview当前(重生成) |
| GET | /api/file/upload/tasks | owner | N | - | 面板历史/可恢复 |

**complete 幂等正文**：`X-Idempotency-Key` task. status在 COMPLETING/SUCCESS 时直接返回成功果(不重跑 OSS Complete)；对 OSS 已 exist & 首次→走完整。若 DB 失败（已 CompleteOSS）用任务泛化补偿（见21.5 preview re-run 用 recovery 修正 status/更新 used）；不产生重复 version 靠 `UNIQUE(object_id,version_no)`+先在 obj 行加锁取 max。

### 17.5 回收站
| GET | /api/trash?drive= | DRIVE_READ(+接管) | | |
| POST | /api/trash/{id}/restore | restore 权限(见12) | K | 1+L | 路径决策+改名；需要 target FILE_CREATE？ 见12.2表显需 (FILE_CREATE+VIEW in target) |
| POST | /api/trash/{id}/purge | FILE_DELETE+MNG | K | 1+L(回收>100k 走 async) | 逐版本 ref--、产物清理标记 |
| POST | /api/trash/empty | MANAGE | K | 拆分 async | 整盘清回收 |

### 17.6 下载/预览/分享
| POST | /api/file/{id}/download-url | FILE_DOWNLOAD | N | - | 短签(Hash/版本) ,只读 |
| GET | /api/file/{id}/preview-info | FILE_PREVIEW | N | - | 若无产物→入队 preview 返回 processing |
| GET | /api/file/preview-task/{jobId} | 同上 | N | - | 轮询 status |
| POST | /api/share | FILE_CREATE? creator 得分享) 校验拥有權 | S | 1 | 建内部分享/链接(URL token/密码/有效) |
| POST | /api/share/{token}/access | guest | N | - | 外链验password生成临时 access，不越权下载以原始 share.perm 力 |

### 17.7 搜索/审计/admin cfg/健康
GET /api/search 搜索见13;GET /api/admin/audit …; GET /actuator/health; GET /api/admin/runtime(见20)。

### 17.8 层次许可汇总(后端最后防线)
统一 AOP `@RequireDrivePerm(drive=,perm=FILE_*)`：解析 drive 通过 path param→ permissionService 求出实际集合→无该 perm 则 403。不可再用"token 带 perm 就放行"。

---

## 十八、安全设计（重点补 policy/session）

### 18.1 STS policy 严格限定（伪代码，D 部署为 RAM 具体策略）
```
Action: [oss:PutObject/UploadPart/Complete/Abort/List/(ListParts)]
Resource: arn:oss:…:<bucket>/source/*   → 更严可再分 /source/d{did}/ 前缀→ by task
Condition 限定(可选)：
   ContentLength: 900MB? (per part with size)
   Optional content-type → absent? put object content type 由前端传命名:不 lib 限制但权限默认禁 public。
```
可把 STS 拆成两种角色：
 - 写分片 STS(部分权限 UploadParts) 极短(秒级需 refresh per task? 一张 STS 支持 multipart life~ minutes 可达(默认 1h) — 若欲 per-part 短签，可对每片 PUT signPolicy 一次性最短 URL 而不给中间 STS —— 因前端直传需多片,常见给“multipart STS 限 prefix/drive + 短 TTL”。结论：multipart 上传用一个 STS(仅该 task), 有效期= task expire(default 30min 可配<=1h由biz)
 - 到 expiry 未完成会自动续 task 用 resume 重发新 STS。
对外前端永不拿 bucket-wide 写册.
读 URL(resource 权限) 一律签名。OSS server-encryption 推荐(SSE-KMS)可选；bucket 私有。

### 18.2 会话与越权复用
- JWT 短/refresh 过期链最长按安全策略；
- 预览/下载/share URL 必须带随机一次性 or 短签+绑定 source IP/user? MVP 用短 TTL(图片1-3min, 文件预置 max) (若超时则 403 前端重新 request)。
- 分享 URL 为独立权限 token域; 不允许多次利用普通登录 token 签署；外链访问受请求级临时会话, 不落 JWT DB。
- 注销(退出/改密/被禁/权限) token_version/jti 见4.3; 下载侧在下发前 is user active & drive 权限现行。

### 18.3 跨端
- 仅 api 域启 CORS 白名单(H5/自建平台可配根)；Content-Security-Policy；用户 content XSS：文件名 escaped, preview 文本 default text/plain 渲染, mime 不信任扩展名(白名单) 关键。
- 上传文件名过滤路径穿越 `../`、控制 `\`、控制 shell 无。 
- 日志脱敏(手机号部分)/审计不含 token。

---

## 十九、审计（补全 action 与 INFO/WARN/ERROR 分级）
表：tb_audit_log（含 request_id）
| col | | |
| request_id | | 全局 ticket(经 interceptor 置ThreadLocal) |
| user_id | dept_id(主dept,可为n？简主) | 
| action | enum: LOGIN LOGOUT_UNAUTH DRAW_UPLOAD DRAW_DOWNLOAD PREVIEW_DELETE PURGE RESTORE MOVE COPY RENAME SHARE_PERM ROLE BLOCK AUTHORIZATION QUOTA_ORGAN_SYNC…
| resource_type/id/drive_id |
| result | SUCCESS/FAIL |
| error_code |
| ip,user_agent |
| detail_json(旧名新名/版本号/大小 量等) |
| occurred_at |
写入策略：同一写链路内同步写(允许异步批量后续优化)：关键写、下载、预览、权限、role、quota、transfer、super admin、钉钉同步(org_sync INFO)。读列表不进。分级：FAIL=Error+reason；限流/401/权限拦截=warn 可选采样；消息做INFO。
检索：时间/dept/user/action/资源范围；M2打日志，M4管理端UI(M1 先 file-append)。
（真正归档保留与滚动到非MVP。）

---

## 二十、监控运维（Actuator 起步）
### 20.1 运行概览(管理端 dashboard/api/admin/runtime): 计数
users, dept, drives, active 文件数(estimate由tb_storage_object drive(active)) 若行多聚合仅top/cache; OSS used by drive(row) sum or bucket metric; 今日 upload/download(Counter Redis 或 DB 每日表), 失败上传, preview running/failed, 任务表 backlog, trash pending(>保留将清理), orphan hash count, 复用 failed; worker 心跳(worker): 多 worker 在 job 心跳超时可视警示。
### 20.2 健康检查 /actuator/health  细分：mysql/redis/oss(读 head)/钉钉(optional)/worker(活跃心跳>=1)
### 20.3 日志：slf4j json + OSS 指标: log file; 用 yaml 级别可调。 
简单运营可用看板dashboard 从 api;统计指标 MVP 从内存 Concurrent + Redis counter；复杂(API latency/吞吐 prometheus)非MVP。错误监控告警：钉钉 webhook 群。MVP 足够。

---

## 二十一、事务一致性 & 状态机
### 21.1 事务矩阵（核心）
| 操作 | 事务边界(DB) | 附带 L | OSS |
|---|---|---|---|
| upload-token | drive预订+tasks+object INIT 同一事务 | Lock drive row; Lock obj(cover) | InitiateMulti(成功后提交;失败滚,无副作用) |
| quick(秒传) | drive used核算+obj+version创建+hash.ref++ | Lock drive; lock target/同名 | 无 |
| complete | drive used/reserved换+version为new+obj.cur+ref++ +task status | Lock drive(再)+ Lock(obj/旧current?) 用同一事务锁 | 已整；CompleteOSS 幂等守卫见前 |
| move/copy/delete/restore/purge/mkdir/rename | 各自单事务 | Lock drive & 来源/目标夹 | 仅 purge 涉及物理删除(标记异步) |
| 权限/成员/配额/transfer | 单事务 | lock drive & 原 owner | 无: 同时清缓存(同事务后失效post) |
| cover(覆盖为版本) | 单事务 | lock obj (FOR UPDATE获取cur) | 上传完成后处理 |
 
### 21.2 OSS 与 MySQL 不一致/补偿
原则：OSS 不作为 DB 事务成员。任何 OSS 成功后 DB 失败 → 依赖下述恢复：
- **complete**: 在完整事务前先调用 OSS Complete（幂等），若 DB 提交失败 → task 停在 COMPLETED_OSS_NOT_DB 的语义? 需一个定义态。加状态 `OSS_READY_PENDING_DB`。恢复 worker 扫该状态：校验 obj current 需重建 version —— 为避免该复杂，MVP 上完全服务尾段顺序改为：**先写 DB 预留新 version(占 slot, obj 锁, 状态 pending_oss) → CompleteOSS(幂等) → 更新 version/hash 落地并 commit**。二段内 OSS success 但第 commit 失败 → job `finalize_upload` 补偿：从 oss 已存在对象上执行 `obj.version=finding(osssize/md5..)`...（过度复杂。）
   更易实现且键于真实推荐的：**OSS(Complete) 在事务开始前先做对自身幂等; DB 事务是可重试的,避免“一边动OSS在事务一半”。** 所以：
    步骤1: Lock drive & obj → reserve new version_no(占位 obj?) 写在 MySQL insert version(status=PENDING) & hash 行 REF? 不行引用需 commit 才别见。可选：以 task 持有元数据，把“新 version+ref”推到本地，等待 complete。 
   最终采用简部署一致方案：
      A. CompleteMultipart 由调用线程执行(需要它足够幂等:有 uploadId 完成二遍会返回已存在或 task 状态）。
      B. 然后 MySQL one-transaction：drive quota 结算+新 version+obj.cur+hash.ref++(+删旧 cur? 不删), task→SUCCESS。失败则写 DB 失败日志, 并给 task 设 `status=DB_PENDING`(扩展态)，job 重试该完整提交(它幂等:new version 唯一，重跑若 version 已存在 → 见 UNIQ avoid double: 以 `db_commit_key`/task meta → 若已 commit 成功就返回 success). 下界确保不重复 +version 不会 double（obj 行锁 + insert 版本唯一(object_id,version_no): recover 时取上限 max-> 若已是 O(存在同) return OK)。
  该机制保证 MySQL 与 OSS 最终一致（重试幂等），无幽灵。
- cancel/fail释放：DB 提交之后再 Abort (若先 abort 后 DB 尚未释放也没关系 hash 无引用只 source 无 record，由清扫) 但为避免漏 Abort 全自动：取消先 DB-set task=cancel; run有孤儿 -> job 用 Abort。逻辑允许 OSS 残余在短暂时间内存在（清扫 job 兜底）。
- purge 物理删除：先在 DB 事务移除引用/置对象 purge; 真正删 OSS/s /preview/thumb 走 orphan 清扫 worker(见15/14.3) 面向 ref_count。

### 21.3 状态机汇总
object/file/life:
INIT(上传中) → ACTIVE(有版本)  ⇄ TRASHED → (purge) terminal deleted→实际 row removed or tomb.
file_version(每 obj 多项)
upload_task state m/c: INIT upload-token→(片)UPLOADING⇄PAUSED→COMPLETING→SUCCESS; FAILED/ERR(可 retry) CANCELLED EXPIRED
preview_job: QUEUED→PROCESSING(heartbeat)→SUCCESS |FAILED(retry/expire) |CANCELLED; PROCESSING 超心跳→QUEUED
hash: ACTIVE→ORPHAN(清扫) 可表 ref_count 归 0 & last_unref_at 后→ delayed rm(GRAY)→DELETE物理。
async_job similar Durable.

### 21.4 加锁策略原则
- 优先 DB 唯一约束（同名/成员/任务/版本NO），能防即可不 Redis。
- 需要“读-改-写”同一资源（配额/当前版本 max/同夹 rename/move）用 DB 行锁(select..for update) 同事务。
- 分布式多实例场景启用 Redis 分布式锁只在跨越 DB 的两步如 rare（清理孤儿删除/delete file+s 异步不须）。MVP 单实例 SQL for update 就保证数据正确 → 不引 Redis 锁到处并发对 non-neede。“lock drive for update 是常态”时 drive 单行热点只在写/配额较多可接受（盘写 QPS 不高）。
- 复杂跨实体(整目录递归 purge) 拆异步避免长锁。

### 21.5 一致性兜底清扫任务
reconc_orphan_hash, reconcile_upload(task 无新/EXPIRED & part stale abort), reconcile_version(obj.cur 指向的 version 未 deleted), trash_expire_purge, preview_expiry/re-run。每天低频扫少量异常，恢复标记。
任务均幂等、可重跑。

---

## 二十二、部署架构（MVP 单体可运维）
```
[nginx/tls/csp] → H5/App/Web via
        Spring Boot 单体 (docker 镜像, 可 2 副本+共享 MySQL/Redis)
        业务 + Scheduler(任务) 同实例
        OSS 直传(STS) 由 web worker/uni SDK
        DB: MySQL8(主), Redis
Preview Worker (独立 deployment docker)：拉 tb_preview_job 执行 / 写回 OSS; heartbeats; 生产者由 API 放入 preview_job。
可选 Job 上 boss：若容器两副本带 scheduler → 用 DB for update skip locked 分布式抢占（单 DDL 即可，不需 Redis）。
部署 artifact README+docker compose:mysql redis app worker, 及 schema.sql seed。
依赖 cloud: MySQL(可 RDS 或自建),Redis(可),OSS,dingtalk。
单体可先一台 App + 一台 worker；扩容为二副本 app + worker 亦同。M5 后可前接 k8s(cn非MVP)。
```

---

## 二十三、前端架构（uni-app 多端）
- 工程：用户端 + 管理端=同一仓库分包（`packages/portal`、`packages/admin`），共享 `common`（`request.js` 鉴权/JWT 刷新/401 跳转、`perm.js` 前端可见性(仅 UI，含后端复核)、`uploader.js`（multipart/进度/resume/队列）），及 `components`（file-list / perm-picker / preview / menu …）。H5 附 OSS client demo（Web Worker）。
- request 层：统一 baseUrl per env；401 refresh(逻辑单飞)；所有写请求带 `X-Idempotency-Key`(uuid) 使重试安全。
- 前端权限仅决定 UI（灰显/隐藏入口）；所有操作走后端 `@RequireDrivePerm` 兜底。列表返回权码集+isOwner，组件据此渲染图标/右键菜单。
- 文件浏览：list Keyset 逐层展开(不整树)；面包屑父链逐级请求；侧边目录树 lazy 展开；目录统计(计数/占用)按需读；整树统计走后端异步 job(非根默认)。
- 上传面板：任务状态以后端 `/api/file/upload/tasks` 为权威；断点点“继续”调 resume 补缺片；暂停/取消调接口；并发由前端节流+队列控制；H5 支持文件夹/多文件拖拽（`dataTransfer` 递归文件→队列，先建相对目录 mkdir 再传）。
- CAD/3D 查看核心页 `pages/preview` 按十四章统一分发 ：preview-info→kind→Cad2d(SVG/图层)/Model3D(WebGL)/TextView/PdfView/ImageView/OfficeView/VideoView。多端 3D 差异：H5 桌面 Q 全体验；App/小程序端能力(WebGL/授权/文件大小)按能力 `#ifdef` 适配，MVP 以 H5 桌面为首要。
- 移动端策略：文件选择、授权、大小限制受平台收窄→同样 `#ifdef` 注入 adapter（上传/3D/文件系统），易替换扩展。

---

## 二十四、M0–M5 实施计划（修订）
**M0 地基(动态库+骨架+原生能力)**
内容：Git/规范目录；新建 Spring Boot 模块骨架：统一响应/异常/分页/ReqId 审计上下文；完整 DDL `schema.sql`(全表含唯一/索引)+`seed.sql`(内建 role)；Actuator health；docker-compose(mysql/redis/app) CI 冒烟。
验收：`docker compose up` 建库成功；health 绿；唯一键与索引齐(评审)；==M0 结束 DB 冻结==(其后记录变更走迁移)。

**M1 登录+组织**
内容：JWT/登录(login/refresh/logout/token_version)强制失效；钉钉免登/扫码→unionId 映射 user；组织建模 dept/users/关联/role；平台 admin 授部门 admin；钉钉组织同步(tb_async_job)手动触发；部门 tree；/me。
验收：钉钉员工登录见部门局/角色；平台 admin 授予生效；禁用/改密旧 token 立即 401(token_version)；同步可重消费/移除。

**M2 空间/文件/直串/下载/版本（核心大件）**
内容：个人/部门盘+owner/member；file 列表(keyset)/mkdir/rename/move/copy/delete(软删)；**上传完整链路**（upload-token 预占 reserved + md5 秒传 + multipart：sync/resume/pause/cancel/expire 清理 job + 前端队列/继续/拖拽/断点）+下载临签短文URL；**版本**(current/history/restore=新版本/delete历史/cover=新版本,obj.cur 原子切换)。
验收：秒传命中不再传；分片断点"继续"不断点返工/失败重试补片不重传片；配额 reserved+行锁并发两上传不同时双超；并发同名 move/rename/对同夹 mkdir 无重名(DB 唯一兜底，另种名错误信息)；改密后下载 URL 短生命失效?带宽/URL 校验；覆盖磁盘旧版历史完整可回滚；并发同 hash 文件上传只一份物理。
依赖 M0/M1。

**M3 回收站+权限/审计完善**
内容：回收站(保留期到点 job 分批 purge / 逐删除 ref-- / 恢复时路径决策+自动改名 / whole 盘清空拆分 job)；permission(Role service+Redis 缓存+即时失效)等(见 5/17 API 全部落)；owner/manager 保护;transfer/配额调整权限修正下位级校验;成员表权限缓存失效串；审计表格落库(见19)+管理端审计查询/过滤。
验收(recheck)：purge 未破坏别的引用(哈希 ref 计数正确经并发测试)；恢复并迁同夹同名自动 (1)；低 authority 用户间/受系统管理下放的授权即时失效；不能递减 owner / MANAGE、不能升到自己等越权场景全部失败正确；审计明细关键动作可检索。

**M4 CAD/3D 预览+搜索+监控(核心 MVP 能力完整)**
内容：Preview Worker(独立) + preview_info/轮询/失败超时/heartbeat（kill 重排队）；预览适配：CAD2d(SVG 由 D3 转? engine 提供者 D3 待 PoC) / 3D(glb 渲染，source 转内核 provider 完) / 图像文本 PDF 直接经 OSS 处理或直出分页; 前端 viewer 2D/3D 页面交互 (放大/缩/图层/装配树—按能力) ；检索 Keyset; 孤儿/补偿清扫 init 上(见15/21)。
验收：样板文件上传→preview 非阻塞生成→2D/3D可查看/旋转；(若 D3 engine 未在 MVP 上市则 stub→403 “预览暂不支持该格式”，主线不阻塞); worker 被杀 job 不卡 PROCESSING(超心跳转 QUEUED)；搜索名/扩展/时间；清扫 log 无孤儿累积。审计概况页。
依赖 M2/M3(预览强依赖上传成功闭环)。

**M5 分享+鲁棒+可选 office/音视频+份额观测**
内容：分享(内部成员/外部链接+密码/有效期/权限 scope 简单只 to read/下载限制 及撤销)；海量稳定性(press/keyset/负载)测试与修复；版本保留历史条数策略可选；office/pdf/音视频预览 +云计费 配置开关键默认 OFF；grafana/prometheus(on存在集群)；文档。
验收：分享 URL 无法越权访问对象其他文件；撤销即失效；压测不破不变量；发布说明+运维 runbook。
依赖 M4。

---

## 二十五、技术决策清单 & 开放项（需业务/上线拍板）
### A. 已定(采纳&细化)
- 栈：SpringBoot3/Java17/MyBatis(select keyset, for update)/uni-app(Vue3)/MySQL8(RDS)/Redis/OSS private + STS/独立 Preview Worker。
- 三段模型 storage_object→file_version→hash(ref_count, 物理去重横向覆盖历史/删除后共享) —— 修正之一。
- 配额 reserved + used/quota used+reserved<=quota 原子(行锁 drive)。权限不在 JWT，服务端实时+缓存失效。幂等同唯一/状态机。回收站软删态+专门 purge。上传/断点在 DB 落 full state machine，残片以 task expiry 清扫。异步事件统一 tb_async_job。
- preview 有独立 job 与 heartbeat。
- 前端基线 uni-app(Vue3)（2026-09-05 已拍板，见下 B-D1）。
- 预览内核采用 provider-pluggable；M4 前先出 PoC 选型(2026-09-05 已拍板，见下 B-D3)。
### B. 开放项（前两项已拍板标记;其余为需在对应 M 前闭环规模/成本项，不作为硬阻塞）
- **D1【已定 2026-09-05】uni-app (Vue3)**：MVP 前端基线。H5/小程序/App（含 parent/三方扩展）。CAD/3D 全体验以桌面 H5 WebGL 为主，真原生 App/小程序端按能力 `#ifdef` 裁剪或承接 web-view，不再使用 uni-app x（除非后续专项要求原生 nvue 再评审）。
- D2 实际数据规模：dwg 单文件典型大小峰值、格式集合（是否含 stp/catia/...）、目录最大子子节数量、同时消费上传用户上限——决定分页/配额/预留粒度、Worker 数与容量（M1 前给出即可调，结构不阻塞）。
- **D3【已定 2026-09-05】先 PoC 再选型**：M4 前出 DWG/2D(ODA Teigha 商业授权 vs LibreDWG 开源能力)+3D(assimp 覆盖面 vs GLB 直出)覆盖与成本对照 PoC；接口 `provider-pluggable`，在引擎未落地期以 stub（返回“预览暂不支持”）保证主线不被阻塞，D3 结果只填充 provider。
- D4 OSS 数据流转 经(Office 文档渲染库/视频转码 MPS/hess 计费)若业务需要预览这些格式才开启，默认 OFF；是否开启需云费用审批（M5）。
- D5 preview worker 规模由 D2 定；若 3D 引擎希望不经后端(由 uni-app(H5 桌面)内 three/loadglb 直接渲染已转换好的 glb source)为一分离关注点——即"已在 OSS 有 glb 的对象直接前端加载"，source 3D(dwg/stp…)转换才需 worker 引擎。
（标注将在正文以"Dx-1/-A"出现的必须由产品业务确认决定；尽量在每 M 前闭环，开发结构不被卡。）

---

## 二十六、预留 – 线上正式章号空间（勿填入）
本草案第 26 章暂不落地；如需章号顺序稳定，可将其作为「决策附录-历史评审」外部排。当前正文建议维持 1–25 +（打补丁登在 27, 若后续无 27 则以§0/§末节增补与日期的修订 CHANGELOG 并存）。

---

## 二十七、原方案问题 & 修正记录（第 25 条产物）
> 说明：每行：原(S)→问题 | 修正(N)→验证。MVP 影响列 ✓需改/△可延体现修正合理性，M0-M5 文中已其落实；作为变更追溯，保留原文态不抹除其句法，证明"方案看是统一演进"。（表格随日期归档每一则与对应处）

| # | 主题 | S 原设计 | 问题 | N 修正 | 章节 | 影响 |
|---|---|---|---|---|---|---|
|1| 配额 | 只 used(不含在途) | 并发预占可达 超额双写风险 | quota+used+reserved，并发行锁，md 在后释放 | §11 | ✓ |
|2| 物理文件 | name OSS “file n-1000-2234.ext” 一对象对一历史版 | 删除/覆盖/副本去重混乱、引用计数缺失, 历史/回滚难回收 | storage_object→file_version→hash 三段 + hash.ref_count(被版本计) | §7/8 | ✓ |
|3| 覆盖语义 | 直接盖旧内容，旧内容丢 | 无历史、可撤销 | 默认"覆盖→生成新版本"，删除/还原配套 | §8 | ✓ |
|4| 权限 | 权限集合打进 token | 无法即时变更/吊销 | token 仅 uid;jti; 权限实时服务+缓存失效 id 路径 | §4/5 | ✓ |
|5| 上传 | 无任务化/无断点/靠网络直传大物件一次 | 大/弱网/幂等缺 | tb_upload_task 全状态机;分片+resume;唯一 requestId 幂等;残片 job 应制 | §9/15 | ✓ |
|6| 并发写怪 队名 | 靠前端代码 | 多端同名可冲突 | DB 唯一(status_tag+name_normalized), cover/上传 换名或冲突返 | §7/17 | ✓ |
|7| 回收站 | 单「删除即降 ref/释放」 | 恢复需要保历史/quota | TRASHED 态保 ref; purge 阶降;restore 恢复自动改名;trash 独立字段 | §12 | ✓ |
|8| 预留 resize | 未明 | 冲突 | quoted | §11 | ✓ |
|9| 状态机 m1 文件逻辑 无明确 | — | 一致/坏机失败途径不完整(如 abort 一半) | object(file/upload/job/hash)生命周期显式状态机;job 心跳/超时重排;补偿清扫 | §9/15/21 | ✓ |
|10| 预览 | 无 worker/无 heartbeat | Cancind kill 卡 | tb_preview_job + heartbeat→重排队 | §14 | ✓ |
|11| 检索 | MySQL LIKE% | 大量数据/权限过滤退化 | Keyset + 前缀/类型过滤 + 每项 scope,性能分页评估(LIMIT offset 禁 换 keyset) | §13/17 | △ |
|12| 审计 | 无 tables | 无迹/判定难 | tb_audit_log 分级 action/资源/结果+请求 id | §19 | ✓ |
|13| 安全(RAM STS) | 给终端一切 ACL | 越权删全桶 risk | sts resource=drive/目录 min 权限+极短 ttl+ private bucket+临签 | §10/18 | ✓ |
|14| 监控 | 无 | 故障黑盒 | actuator 健康 + 心跳看板 + admin runtime | §20 | ✓ |
|15| 一致性补偿 | 无 | OSS/DB 两中心文件不一致 | 幂等重试 + Uniq + 安全清扫兜底;OSS不是 DB 事务成员, 失败补偿 | §21 | ✓ |
|16| office/音视频 | 一律把预览做 | 计费复杂非核心 | 云能力开关默认 OFF, CAD/3D 为主 | §24-M5/25-D4 | △ |
|17| 端口/未来 | 一上来微/消息中间件 | 复杂/运维重非MVP收益 | 单体 App + 独立 worker + DB 队列 skip locked 阻塞复用;扩展性预留不前置 | §22/15 | ✓ |

> 归档：上述各“修正”的实现/验收分布见 §24 对应里程碑，亦在 §25A 决策汇总；任何在后续实现复核中发现与本文不一致的新变更须在此追加第 N 行并标注日期/关联章节，保持本文档为唯一可审的“因果账本”。

