# 霍桐PDS 技术设计方案

> 企业内部网盘系统（仿阿里云网盘与相册服务 PDS）
> 定位：公司内部文件数据管理平台，前端多端（App/H5/小程序/PC），后端服务于管理端 + 用户端。

---

## 一、项目总览与需求边界

### 1.1 项目定位
- **目标**：搭建企业内部网盘，实现文件「集中存储、统一管理、部门共享、按权访问」。
- **对标**：阿里云盘企业版核心能力（文件管理、共享、回收站、秒传/断点续传、在线预览、权限）。去掉对外开方、计费等云商特色。

### 1.2 核心范围（本期 MVP → 迭代）
| 模块 | 本期 | 说明 |
|---|---|---|
| 登录/鉴权 | ✅ | 钉钉扫码/免登 + OAuth 授权登录 |
| 组织架构同步 | ✅ | 从钉钉拉取部门 + 成员 + 角色 |
| 文件管理 | ✅ | 新建/重命名/删除/移动/复制/下载 |
| 上传下载 | ✅ | OSS 直传、秒传、断点续传、批量 |
| 个人空间 | ✅ | 按用户配额（可由管理员/部门配额推导） |
| 团队/共享空间 | ✅ | 按部门维度建立共享空间 + 角色授权 |
| 回收站 | ✅ | 默认 90 天，可恢复/彻底删除（配置化） |
| 分享 | 🔜 | 内部成员分享 + 外链分享（含有效期/密码） |
| 在线预览 | 🔜 | 文档/图片/音视频（OSS + 转码/签名 URL） |
| 收藏/标签/搜索 | 🔜 | 文件检索（名称/类型/时间/部门） |
| 审计日志 | 🔜 | 操作入日志，可按用户/部门检索导出 |

> 本期先打通「登录 → 组织同步 → 文件管理 → 上传下载全闭环」，后续按模块迭代。

### 1.3 角色与端
- **普通用户**：个人空间自用 + 被授权部门空间的读写。
- **部门管理员**：管理部门共享空间、成员、配额。
- **平台管理员（管理端）**：全局组织、空间、配额、审计、配置。

---

## 二、系统总体架构

### 2.1 物理拓扑示意（文本架构图）

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端 (多端)                          │
│   uni-app 统一工程 → App / 微信·钉钉小程序 / H5 / PC·Web        │
│     管理端App  │  用户端App（同一套后端）                        │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS (JSON API + multipart/七牛式直传签名)
┌───────────────▼─────────────────────────────────────────────┐
│                     Spring Boot 网关/API 层                   │
│   登录鉴权 组织同步 权限过滤 空间配额 文件元数据 分享 审计          │
└───────┬───────────────────────────────┬─────────────────────┘
        │ OSS 签名直传（STS/Policy）      │ DAO / 事务 / 缓存
┌───────▼────────┐              ┌───────▼─────────────────────┐
│   阿里云 OSS    │              │    元数据库 (MySQL)          │
│   文件内容存储   │              │  用户/部门/空间/文件/分享/审计  │
└───────────────┘              └───────────────┬─────────────┘
                                                │ 定时任务/HTTP
                                    ┌───────────▼───────────────┐
                                    │  钉钉开放平台 (组织架构/免登)│
                                    └───────────────────────────┘
```

### 2.2 架构分层要点
1. **前端**：单一 `uni-app` 工程多端编译；管理端与用户端作为两个 pages 包/入口（或独立工程），共用组件与 API 封装层。
2. **后端**：单 Spring Boot 单体（先单库），模块化包结构，预留向微服务拆分。
   - Controller（REST） → Service（业务/事务） → Mapper（MyBatis-Plus 或 JPA）→ MySQL
   - 独立模块：`auth` `organization` `drive/file` `storage-oss` `share` `audit`
3. **存储**：文件走 **OSS 客户端直传（签名 URL / STS）**，服务端只管元数据与权限，不中转文件字节，省带宽提升并发。
4. **外部依赖**：钉钉开放平台（组织架构拉取 + H5/扫码免登）。

---

## 三、钉钉对接与鉴权设计

### 3.1 钉钉对接能力
| 能力 | 用途 | 触发方式 |
|---|---|---|
| 组织架构同步 | 部门/成员/角色 落库 | 定时任务 + 管理端手动刷新 |
| 免登/扫码登录 | 员工登录 | 钉钉内 H5/小程序 API |
| 员工基础信息变更 | up/down 同步 | 事件回调订阅 |

### 3.2 账号体系映射
- 以钉钉 `unionId/userId(加密)` 作为**员工唯一外部标识** key 落库到 `sys_org_user.external_user_id`。
- 本地自维护一套内部 `userId`，与钉钉 id 解耦，便于自建管理员（不一定要有钉钉号）与账号回收。
- 支持「平台超管」本地账号（首启初始化），可绑定或不绑定钉钉。

### 3.3 登录流程
```
H5/小程序免登：
 前端 → 钉钉jsapi getAuthCode(code)
      → 后端 /auth/dingtalk 用 code 换 userinf(via appKey/secret)
后端校验 → upsert 用户 → 签发 JWT(含 userId/部门/角色) 
      → 前端存储 token，后续带 Bearer
扫码登录(PC/App)：走钉钉 OAuth 授权码 → 同上换 token
```

### 3.4 组织架构模型（业务维度）
以「同步自钉钉的部门树」作为共享权限载体，弱化钉钉『部门』与『自定义角色』到三张核心抽象，避免强绑钉钉：
- **部门(Dept)**：树形，来源=钉钉 or 本地补充。
- **成员(User)**：归属根部门，携带本地角色。
- **角色(Role)**：`平台管理员 / 部门管理员 / 普通成员`（后续可扩展自定义）。

---

## 四、权限模型

### 4.0 权限分层总览
系统权限分 **平台管理员(管理权限)** 与 **空间内的功能权限** 两层，均可由管理员细粒度地开启/关闭：

```
层级A · 平台管理权限(谁能进入管理端后台)
   平台管理员 / 部门管理员：由超管/更高层在「成员管理」授予 → 决定谁能配置空间与成员

层级B · 空间内功能权限(用户在某个空间里能做什么)
   平台管理员/部门管理员在「该空间-成员设置」里，为每个成员勾选【操作权项】
   —— 这是您需要的最核心能力：仅查看 / 编辑查看 / 新增 / 删除 …… 逐项可配
```

### 4.1 空间(Drive)与权限承载
PDS 用 `domain → drive → (user/dept) 授权`，我们把它落到一张「空间成员-权限」表，不依赖固定的三种角色，而是**组合式操作权项**：
```
部门共享盘 = 部门空间； 个人盘 = 个人空间
每个空间都有一个成员列表(space member)，每个成员绑定一组操作权项(permissions)
```

### 4.2 操作权项设计（组合式，可多选）
定义一套**功能权限码(perm code)**，管理员在其中勾选组合，作为用户在「该空间」的操作边界：

| 权限码 | 名称 | 含义 | 对应粗档 |
|---|---|---|---|
| `VIEW` | 查看/浏览 | 进入空间、目录浏览、查看文件列表 | 仅查看 |
| `PREVIEW` | 预览 | 在线预览内容(隐含 VIEW) | 仅查看 |
| `DOWNLOAD` | 下载 | 下载文件(隐含 VIEW) | 仅查看 |
| `UPLOAD` | 上传新增 | 上传文件、新建文件夹(隐含 VIEW) | 新增 |
| `RENAME` | 重命名 | 对文件/夹重命名(隐含 VIEW) | 编辑查看 |
| `EDIT_CONTENT` | 内容编辑 | 覆盖/编辑文件内容(隐含 UPLOAD) | 编辑查看 |
| `MOVE_COPY` | 移动/复制 | 移动、复制、粘贴(隐含 VIEW) | 编辑查看 |
| `DELETE` | 删除 | 移入回收站 / 恢复回收站(隐含 VIEW) | 删除 |
| **`FULL`**  | 全部权限 | = 以上全部，快捷全选 | — |

- 提供**快捷档**：`仅查看 = VIEW+PREVIEW+DOWNLOAD`；`编辑查看 = 仅查看 + 可写类(上传/重命名/编辑/移动)`；`新增/删除`等再单独点开关。
- 平台/部门管理员本身默认持 `FULL`（可管理，可再收回）。
- 空间 owner（如个人盘本人）默认 `FULL` 且不可被移除。

### 4.3 授权强约束
- 最小可用权限以「功能权限码」在**后端**判定：用户携带的权限集合里**不含**某权码则对应 API 直接拒绝（前后端都会做，以后端为准）。
- 回收站恢复也走 `DELETE`(或单独 `RESTORE`) 权码，防止只可上传用户误删/清空别人内容。
- 个人空间即使授权了他人，也默认只开放管理员显式开启项；不开放他人「删除/清空」的默认项。

### 4.4 默认角色(粗档)与细粒度权项的统一
预置三种角色，仅为「快速设定」桶，实际生效的是**角色展开出的那组权码**，管理员可在此之上再做调整继承/覆盖：
```
DEMO：
  部门管理员 = FULL（可管理该空间）
  普通成员   = 仅查看（VIEW+PREVIEW+DOWNLOAD，管理员再按需开放新增/编辑/删除）
  访客(只读) = PREVIEW+DOWNLOAD（连浏览列表外的操作都关闭）
```
> 判定优先级：若有「空间成员记录」→ 以该成员的勾选权码为准；否则取该用户角色对应的默认权码桶；都查不到且非 owner → 无权限(仍可见则不显示)。

### 4.5 可见性
用户在前端仅看到**自己被授权(含只读 VIEW 或以上)或 owner 的空间**；文件级操作除校验登录态，每次 API 还会用 token 内携带的空间权限码二次判定（`对 drive 的操作需包含目标权码`），杜绝越权遍历。

---

## 五、数据库设计（核心表 + 关键字段）

> 统一约定：主键 `id bigint` 自增或雪花；软删除 `deleted`；审计字段 `created_by/updated_by/created_at/updated_at`。时间一律 `datetime/UTC`。

### 5.1 组织域
```sql
tb_dept          -- 部门
  id, parent_id, name, source(dingtalk/local),
  dingtalk_dept_id, sort, status, deleted, ...

tb_user          -- 成员(平台账号，含超管)
  id, external_user_id, name, avatar, mobile, email,
  root_dept_id, status(active/disabled), is_super_admin,
  last_login_at, deleted, ...

tb_user_dept     -- 用户-部门多对多(一人可属多部门, 主部门 first)
  id, user_id, dept_id, is_primary

tb_role          -- 角色字典
  id, code(SUPER_ADMIN/DEPT_ADMIN/MEMBER), name

tb_user_role     -- 用户-角色(全局或限定部门)
  id, user_id, dept_id(nullable), role_id
```

### 5.2 空间/配额域
```sql
tb_drive         -- 空间(个人/部门/相册预留)
  id, drive_type(PERSONAL/DEPT), owner_dept_id, owner_user_id,
  name, status, quota_bytes, used_bytes, trash_enabled, deleted, ...

-- 部门空间则 owner_dept_id 有值；个人空间 owner_user_id 有值。
```

```sql
tb_drive_member    -- 空间成员及细粒度权限(核心：组合式操作权项)
  id bigint PK,
  drive_id bigint,          -- 关联空间
  user_id bigint,           -- 被授权成员
  role_id bigint null,      -- 可选：来自的默认角色桶(仅记录来源，便于调整)
  perms varchar(255),       -- 授权码集合, 逗号分隔: "VIEW,PREVIEW,DOWNLOAD,UPLOAD,..."
                            --   空串=未授权; "FULL"=全部
  is_owner tinyint,         -- 是否空间 owner(个人盘本人/部门盘本人持拥有态,不可移除)
  can_manage tinyint,       -- 是否有空间管理权(进行本表授权、配额、回收站接管)
  granted_by, granted_at,
  deleted tinyint
  -- 索引: (drive_id,user_id)  唯一约束: (drive_id,user_id) 未删时唯一
  -- SQL 表达去重去回滚：用 JSON_ARRAY 存权码 或用如上 CSV 由后端解析为 Set 统一鉴权
```
> 后端会维护一套统一鉴权组件 `permChecker(driveId, userId, requiredPerm)` 读取本表合并角色桶后决定放行/拒绝。

### 5.3 文件域（核心，自研元数据）
采用「目录即逻辑节点」的扁平表，支持海量目录快速展开。

```sql
tb_storage_object   -- 逻辑文件/文件夹 节点
  id bigint PK,
  parent_id bigint,          -- 上级(根=0)
  drive_id bigint,           -- 归属空间
  obj_type(FOLDER/FILE),
  name,                     -- 逻辑名(原始)
  name_normalized,          -- 小写+去首尾空白, 供判重与唯一约束(见 6.0)
  actual_name,              -- OSS object key 的物理名(去用户名/随机)
  size_bytes bigint,
  file_ext, content_type,   -- 预览/下载用
  etag,                    -- MD5 秒传校验
  hash_id bigint,           -- 物理内容指纹(秒传/去重)
  status(active/in_trash/final),
  trashed_at, deleted_at,
  created/updated/created_by,
  deleted tinyint
  -- 索引: (drive_id,parent_id), (hash_id), (name); 判重唯一约束: (drive_id,parent_id,name_normalized,status=active 需含 deleted/trash 过滤, 或用 generated status_scope)

tb_hash             -- 内容去重表(秒传)
  id, hash_id, oss_key, size_bytes, version, ref_count

tb_object_acl       -- 目录级授权(可选,迭代)：与空间成员权限类似，对某文件夹单独赋权码
  id, object_id, acl_target(DEPT/USER), target_id, role_id nullable,
  perms varchar(255),            -- 同 tb_drive_member 的权码集合
  is_owner tinyint, deleted
```

### 5.4 分享/审计域
```sql
tb_share            -- 分享记录
  id, object_id, drive_id, share_type(org/link),
  target_type, target_id, perm, expire_at, status,
  password(link), url_token, created_by, deleted

tb_audit_log        -- 审计
  id, user_id, dept_id, action(create/delete/download/move...),
  resource_type, resource_id, ip, ua, detail_json, occurred_at
```

### 5.5 预览/转码任务域
```sql
tb_preview_job     -- 转码/文档转换任务(异步状态机)
  id, object_id, drive_id,
  job_type(DOC_TO_PDF/IMM_DOC/VIDEO_HLS/VIDEO_THUMB/AUDIO/IMAGE_THUMB),
  provider(imm/mps/vod/libreoffice/none),  -- 实际处理方
  source_key,              -- 源 OSS key
  status(queued/processing/success/failed/expired),
  result_json,             -- 产出(msu3l8 key、封面key、pdf key、码率列表等)
  error_msg, retry_count, created/updated
```

### 5.6 上传任务(断点分片)域
```sql
tb_upload_task       -- OSS 分片上传任务(断点续传状态机, 后端持久化 uploadId 与分片)
  id bigint PK,
  drive_id, parent_id,       -- 落点(空格/目录)
  target_name,               -- 最终落名(6.0 冲突规则可能改)
  file_name, file_size, file_md5,   -- 原 info /(秒传命中也先记)
  oss_key,                   -- 物理 key(已在 upload-token 定)
  upload_id,                 -- OSS InitiateMultipartUpload 得到, 持久化(跨会话续传关键)
  initiator_id,              -- 谁发起的任务(可他人续传/重试时校验)
  status(created/uploading/paused/completed/failed/expired/cleaned),
  total_bytes, uploaded_bytes,   -- 进度统计(bytesDone/可 ListParts 校准)
  etag_list_json,            -- 已传分片 ETag/partNumber, 用于 CompleteMultipartUpload; 刷新后校准可从 OSS ListParts 重新拉
  finished_object_id,        -- complete 后落成的节点 id
  error_code, error_msg, retry_count, created/updated
  -- 索引: (initiator_id,status),(drive_id,parent_id)
  -- 保留策略：任务完成/失败后 N 小时清理; paused 超时未继续则由 job 轮询 OSS AbortMultipart/取消 release
```

### 5.7 存储/云资源配置
```sql
tb_storage_config   -- OSS/钉钉/MPS/VOD/IMM 等云资源配置
  id, storage_key(oss|dingtalk|imm|mps|vod|preview),
  enabled, quota_limit(可选，异步计费额度/开关), props_text(json), create/update
```

---

## 六、上传下载与 OSS 直传方案

### 6.0 命名与重复(同名)规则（重要：统一口径，贯穿文件全操作）
> 区分两种"重复"，行为不同：

- **结构重复 = 同父目录下 name 冲突(同名夹/同名文件)**：逻辑树中「同一空间内同一父目录」不允许两个节点 name 完全相同(node 层唯一约束 `(drive_id,parent_id,name)`)。遇到同名时的处置由**场景**决定：

| 场景 | 默认行为 | 说明/接口参数 |
|---|---|---|
| **新建文件夹 / 单文件上传 / 重命名** | **弹窗让用户决定**：①覆盖(替换同物) ②**保留两者、自动改名**(`原.dwg → 原(1).dwg`) ③取消 | 交互每次单次，用户能选。`mode=ask` |
| **跨目录移动 / 复制(拖拽内置) / 批量上传** | **自动改名不打断**：依次补 `(1)` `(2)`… 找到目标父目录不冲突名 | 批量多选时逐个弹窗会卡顿，`mode=autoRenumber` |
| **回收站侧** | 不冲突：restore 回原目录若原位置被占用→按自动改名放回 | restore 同名自动 `原(1)` |

  - **重命名冲突**同样落入"自动添加序号后缀"或弹窗（看用户当前是单个重命名动作 → 用弹窗）。
  - 自动改名函数：`nextFreeName(parentId, baseName(sans ext), ext, usedSet)` 在服务端原子、前置冲突检查，避免并发相同(1)。
  - **轻提示**：自动改名路径(尤其批量移动/上传)完成时，top 提示「新.tif(同名)已存为 新(1).tif」并可查看；并发移动名后的多条聚合为一条。

- **内容重复 = 名称无关，仅 MD5/哈希相同(可用秒传)**：由 `tb_hash + ref_count` 物理复用(见 6.1 秒传)。同内容不同名字各自保留逻辑节点，互不影响，不触发改名。

- **跨空间同名**：各空间自身空间维度，同名允许(如 dept A 与 dept B 都有 `图纸/`，各自作用域独立)，仅在**同一空间同一父目录**内判重。部门盘多人同夹由上层成员权限(见第四节)控制谁能写入其内，命中同名仍走上表规则。

- 大小写/trim 一致判定(Windows 习惯保持能显示)：建立 `name_normalized` 冗余列(小写+去首尾空白)做判重索引，兼顾用户体验与数据库唯一约束友好。

### 6.1 推荐链路：OSS 直传（客户端拿签名直传）
```
后端生成上传凭证：
  POST /api/file/upload-token (校验权限/配额)
    1. 计算逻辑节点插入/占位，分配 object 物理 key
    2. 调用 OSS STS 或 Policy 签名，返回 {ossKey, uploadUrl, headers, securityToken(如需)}
    3. 秒传 precheck：前端先算文件 MD5 → /api/file/quick 命中则直接登记元数据返回成功

客户端：
  本地/小程序用 uni.uploadFile 或第三方 SDK → 直传 OSS(大文件走分片)
上传完成：
  前端 POST /api/file/complete/{{uploadTaskId}} → 服务端完成 Multipart/写 meta, 置 status=active 挂入 drive 树
秒传：hash_id 命中 → ref_count++ → 复用同一 oss 物理对象，多个逻辑节点引同一内容(不入分片任务)。
```

#### 6.1.1 上传节奏总览(小文件/普通走单请求，大文件分片)
- 非分片小件：`list.ts`,uni.uploadFile 单 POST 直传 → 秒传/普通。
- 大文件(>阈值 可配 默认 8~100MB+ 或 CAD 码大) → 多段 multipart(后端持/签 upload)，走下方分级续传。

#### 6.1.2 分片 + 断点现状的精述(对应 5.6 tb_upload_task)
```
触发/初始化段
  1) POST /file/upload-token(校验 UPLOAD权 + 配额 + 落名按 6.0 冲突) 
     后端: Insert 元数据占位 → OSS InitiateMultipartUpload → 返回 {taskId,ossKey,uploadId} →
     tb_upload_task(status=created), 持久化 uploadId(跨会话续传关键)
  2) 前端 MD5 precheck /quick，命中直接 complete 返回

分片上传段(可多并发, 每分片≤ 5~8MB -> 见并发控制)
  3) 后端依 uploadId 签"单个分片签名"(或 STS), 前端逐个上传得到 ETag
  4) 前端每成功一片调后端 syncPart(或节流) 更新 uploaded_bytes 与 etag_list_json;
     亦可在续传时让后端 listParts 直接从 OSS 校准已传分片，两路互补防丢
  5) status=uploading/paused 随进度推进; paused 由前端"暂停"置位

中断/刷新续传段 (强度: 分片级续传+可恢复, 状态持久化在后端)
  6) 用户刷新/断网/杀进程返回任务面板 → 未完成任务(按 initiator 或任务列表) 显示"继续"
  7) 继续 → GET /file/upload/:taskId/resume
        后端: 校验仍在有效期 & ListParts 拉已传 parts → 前端据此只补传缺的 partNumber，
                不必重传其余(断点到"片"粒度而非重传整文件)
  8) 超时/过期兜底: tb_upload_task 长时间 paused/created → job 轮询
        AbortMultipartUpload 并清理资源/任务(避免孤儿分片计费)

完成/失败尾段
  9) 全部 part 就绪 → 前端 POST /file/complete/:taskId
        后端 CompleteMultipartUpload → 生成 etag(md5/完整校) → 把占位元数据标 active/更新 size,
        uploaded_bytes=total → 状态机 completed, close/清残留 part
 10) 失败/取消 → 可由"重试"(续传)或"取消"(后端 abort 释放配额占用并清理)
```

#### 6.1.3 前端上传任务面板(UI 与操控)
- 呈位：点击图标在**底部横向任务条(当前队列)** + 可展开**历史/"更多"面板**。
- 每文件一项：`进度条(含百分比/XX MB 已传/总分片)` + 状态徽标(排队/上传中/暂停/续传中/完成/失败) + 右侧按钮 `暂停|继续|重试|取消` + 文件缩略/类型。
- 断点体现：正在传的项刷新页面后**不丢失**，回到面板点“**继续**”即 resume(走 6.1.2 步骤6-7)；批量页提供“全部暂停/全部继续/全部重试”。
- 错误项显示原因并可“重试仅失败者”；完成项吸合到当前目录、顶部轻提示最终落名(如有改名)。
- H5 手机端弱化为原生"选择文件后直接入面板"，手机多选大文件也可走同套断点；小程序沿用其受文件大小/授权限制的取值，但接口复用。

**好处**：服务端不经过大字节；公网/内网都只占对象存储带宽；上传并发高、秒传显著降成本；断点到位后真正「只补缺片不重传整文件」。

### 6.2 下载
```
下载：POST /api/file/download-url  → 验权 → 返回临时签名 URL(OSS) + 附件名
回收站删除：软删 → 90 天后定时任务物理删除 OSS + 元数据(硬删)。
```
> 预览能力见 6.4，已针对设计源件(CAD/3D)为主做专项设计。

### 6.3 权限/配额强约束点
- 配额校验在**上传 token 签发前**与 **complete 后**两段做，防超配额。
- 所有对象读接口统一过 `drive × 权限码` 校验中间件，杜绝越权遍历（见 4.5）。

### 6.4 在线预览（以 CAD/3D 设计文件为主，工程源/脚本/常规文件为辅）

> 结合「文件在 OSS，元数据自研」「公司内主要文件为 CAD/3D 图纸、工程源、二次开发脚本」，预览围绕**设计域轻量化转换 + 自建 Job 节点**构建。所有预览/渲染产物均由后端签发临签 URL，用户端始终拿不到原始永久对象，二次校验 `VIEW+PREVIEW` 权限码。

#### 6.4.0 文件类型 → 预览策略总表
| 类别 | 示例扩展 | 预览策略 | 渲染端 |
|---|---|---|---|
| 2D CAD | dwg/dxf/dwt | Job 节点导入 → 导出矢量(及含图层/缩放) | 前端 2D 矢量查看器 / 大图缩显 |
| 3D 模型 | 3ds/obj/fbx/stp/stl/gltf 及图纸内嵌 3d | Job 节点 → 轻量 `glTF(.glb)+Draco` | 前端 WebGL 渲染(旋转/缩放/剖切/量距) |
| 工程源/脚本/代码 | prj/bas/lsp/宏/json/txt 二次开发脚本 | 文本/代码查看器（只读、防下载可后配） | 文本查看 |
| 图片 | png/jpg/svg/gif/tiff/bmp | 原生签名 | `<image>`/H5 viewer |
| PDF | pdf | 直接 PDF.js（本身已是可分发矢栅） | H5 PDF 查看器 |
| 通用文档/音视频(如混存 office/mp4) | doc/xls/ppt/mp4/... | OSS×IMM/MPS 转 PDF/HLS(复用 6.5 通用辅能力) | viewer/播放器 |

> 说明：根据已确认需求，「**图上在线看图 / 3D 在线旋转缩放**」「**工程源/二次开发脚本**」是骨架能力；Office/音视频不属于主序列，仅作 P4 通用辅助，见 6.5。

#### 6.4.1 整体链路由 Job 转换节点承接（容器化）
```
业务层(提交/编排)                     转换工作节点(可独立扩容, 建议 Docker/可灰度)
Spring Boot(preview模块)  →  OSS(源)   /convert-worker 拉源
   ├ 创建 tb_preview_job(queued)        按类型分发:
   ├ 写消息队列(MQ/DB task)            ├  2D: 图纸内核 DWG阅读/内核→svg/大图+图层json
   └ 轮询进度/回调更新                   └  3D: Assimp/能力库 读源 → glTF/glb + Draco + 缩略图
分页/调度器(spring/xxl)               转换产物回写 OSS(私有, .preview/ 前缀或独立域)
节点可置换：PreviewProvider 抽象(不同内核可切换)，Job 状态机落 tb_preview_job。
```
- 转换是**异步**：`queued → processing(struct run) → success / failed(带 err) `；前端对「可在线预览」文件可见一个状态角标，成功后开放看件入口。
- 常规文件(图片/pdf/文本)不产生 Job，直接触发即时预览(快小)。
- 涉及授权内核的节点使用单独 RAM 角色 + 独立桶前缀，最小权限；转换计算可上云/私网 K8s。

#### 6.4.2 2D CAD 预览要点
- 由转换内核(待定厂牌/开源)拉取 DWG/DXF → 抽取：各视口/图层(text/标注/块)、边界与关键图层开关，产出：
  - `preview.svg`（矢栅，用于前端放大不失真、缩放、图层开合，兼顾只读，不泄原始隐私 xref 深层）
  - 兼大档也产出 `preview.png` 大图做缩率显的快速缩略
  - `meta.json`(图框名称/比例/图层/图纸集信息)，便于检索/审计与「版本草稿/图纸目录」。
- 前端 2D 看图组件基于 svg viewer，多用于工程图的平移/缩放/量(可选)与图层开关。

#### 6.4.3 3D 模型预览要点
- 转换 Job 导入 obj/3ds/fbx/stl/stp/gltf… → 归一为 **glTF2(.glb)**，开 Draco 压缩；面片数过多触发减面/实例化优化，产出：
  - `preview.glb`(+可选 .ktx2/PBR 贴图集) + `preview.poster.png`(封面环拍缩略) + `meta.json`(包围盒/单位/面数/贴图清单)
- 前端 WebGL 查看器(需要 WebGL1/2；多端 H5/App 可用能跑 WebGL 的 webview/nvue container)，交互：旋转/平移/缩放/线框/半透明/剖切(切平面)、可配量距与注释、测量。大模型可开启实景 LOD 渐进加载与 Draco 流式细节。
- 单位与坐标保持(X轴线型/Y轴向)，保证与其他图层对齐；部分来源如果纹理/材质复杂(如 3ds 旧格式)则先行精简贴图打包，产物不超过可控阈值(可配)。

#### 6.4.4 前端统一预览出口
```
GET  /file/:id/preview-info        # 依扩展名分发 kind(见总表) + 各产物临签 URL + 任务状态(待审进度支持轮询)
  → { kind : 'cad2d-svg'|'model-glb'|'pdf'|'image'|'code/text'|'video-hls'|'office-pdf'|'audio'|'none',
      status,            # ready/processing/failed/offline
      main:[{'url','ext'}], meta, poster, layers(...) }
GET  /file/:id/preview-task        # 某文件转换任务进度(前端异步轮询)
前端：统一 viewer(handler) 组件分发到: 2D CAD 视图 / Three.js-esque(WebGL) 模型视图 / PDF.js / 文本 / 图放
```

#### 6.4.5 预览权限安全要点
- 产物一律**临签短时效**，不向业务暴露 OSS 永久地址；下载禁用时对文本/PDF/glb 不返回 `response-content-disposition: attachment`。
- 敏感源(未发布/原本地工程)可配「云上看件但**不支持下载源件**」：预览产物不带原实体；上传下载 token 也剔原 key 发放。
- 回收站文件停发新临签；缓存/产物按该 object 失效一并清理。
- 文本/代码/脚本预览只读，必要时加水印（逐角色可配置）。

---

## 七、后端模块拆分（Spring Boot）

```
com.htong.pds
  ├─ config           通用配置(JWT/Security/MyBatis/Redis/OSS/钉钉)
  ├─ security/auth    鉴权、钉钉登录、JWT 过滤器(前后端)
  ├─ org              dept/user/role 组织域
  ├─ drive            空间/配额
  ├─ file            文件节点/树/回收站/移动复制
  ├─ storage.oss      STS/签名/分片/秒传
  ├─ preview         设计件轻量化 Job 编排：2D CAD→svg、3D→glTF(glb)+缩略；Office/音视频 IMM/MPS(6.5) 辅
  ├─ share            分享
  ├─ audit            审计
  ├─ job              定时任务(钉钉同步/回收站清理/转码任务队列/孤儿分片与过时 upload 清理/产物过期清理)
  └─ common           统一响应/异常/分页/工具
```

技术要点：
- 认证：Spring Security + JWT；`@RequirePerm(code)` 注解做接口级 RBAC。
- 缓存：Redis 存钉钉 token、组织快照、热门目录。
- 定时：Quartz/XXL 同步钉钉 + 回收站巡检。
- 应用自身 token/secret 不硬编码，入 `tb_storage_config` + 环境变量。

---

## 八、前端多端方案（uni-app）

- 单工程多端：`uni-app x` 或 uni-app (Vue3) —— 用 ***uni-app x***（若目标含 App+nvue 强原生诉求可选新的 uts 方案；若以兼容小程序/H5/PC 为主，用 Vue3 + PagesJson + easycom globals）。
- **目录规划**：
```
霍桐PDS项目/
  ├─ 管理端 HBuilderX 工程(或作为 uni_modules/pages 分包)
  │    pages  dashboard/用户/部门/空间/配额/审计
  │    └─ 空间详情页内含「成员与权限」子页：
  │         空间成员列表 → 勾选操作权项(仅查看/编辑/预览/新增/删除/移动.../全部)
  │         提供人员邀请、角色桶快捷档、移交管理权入口
  ├─ 用户端 工程或 pages 分包
  │    pages  我的文件/共享空间/回收站/上传下载/预览/分享
  └─ common  request封装(token注入/刷新)、oss上传、下拉刷新组件
```
- **权限组件(管理端复用)** `perm-picker.vue`：渲染 `/admin/perms-meta` 返回的权码，支持「按成员存档」多选与快捷档(仅查看/编辑查看/全部)；移动端可折叠，勾选框即存即用。
- **封装要点**：
  - `request.js`：统一 baseUrl、Bearer、401 刷新、错误 toast。
  - `oss-upload.js`：uni.uploadFile 封装成可暂停/续传 promise 任务队列。
  - 登录态一致性：钉钉免登 code 换 token 保存在本地 + 同步。
- 多端差异 mask：小程序无大文件本地选择、文件系统权限有差异，抽 adapter 层。

### 8.1 PC/Web(H5) 端拖拽交互（桌面增强，仅 H5 生效）
> H5 桌面端模拟本地网盘拖入与拖移，与手机端"选择文件"并存，目录/上传/权限完全同一套后端。所有落地以 H5 条件编译 + 浏览器 Drag & Drop 实现，手机端(无系统级拖拽)自动隐藏该交互。

- **能力范围**
  1. **拖入上传**：从 OS 把文件或整文件夹拖到文件窗格 → 解析 Web`DataTransfer.files`+`DataTransferItem.webkitGetAsEntry`(目录)递归 → 进入现有上传任务队列。
  2. **拖入移动(夹内重组)**：将网盘内选中文件/夹拖到另一目标文件夹/空白处(或空间根)高亮预览 → drop 触发快速移动；同类也可整格拖到目录树某空间/夹。
  3. 悬浮图层即可放置目标(目录树/当前夹/回收站入口)时显示允许/禁止光标，drop 前前置校验。

- **拖拽 → 上传任务衔接(复用 M2 全链路)**
  - 拖入即按目录/文件**预检**：`POST /file/upload-token`(校验目标夹 UPLOAD 权码+配额) + `/file/quick`(MD5) 命中秒传。
  - 建立一个与 OSS 队列兼容的任务项：`{ file, folderPath, total, done, status, srcState }`，走同一套并发数限制(e.g. 3~5)、进度、暂停/取消、失败重试/续传(logic 断点持久化)。
  - 文件夹上传 = 先在目标下 `mkdir` 建目录骨架，再按相对路径逐个入队；桌面端要保留大文件断点，服务端记录 partition。
  - 拖入不改权限：无 UPLOAD(或无 MOVE) 的目标 drop 提前报"无权在此上传/移动"。

- **移动拖拽(内部)校验**
  - drop 移动走既有 `POST /file/move`（目标夹需 MOVE_COPY 权码 + 需在目标夹有 VIEW，避免移进别人只读区）；进行 cycle 检查（禁止拖入自身后代），权限不足给出明确错误。
  - 移动采用"本地先行乐观 UI + 后端落定回滚"贴走，短暂高亮目标。
  - 回收站 drop：对具有 DELETE 权码的资源做入回收站。

- **实现承载/兼容提示**
  - 统一写为自定义指令 `v-dropzone` 与 `makeDraggable/onDragend` 小工具，组件内部用媒体查询只在 desktop/uni-app H5 挂载，避免 App/小程序引入非标准事件报错。
  - WebGL/上传 window 校验、深夹递归防抖、超大批量分批提交与放队列排队提示（不等所有 token 一次性拉取）。
  - 若内部出现数千文件拖入，避免全量 token 瞬间并发，任务队列设上限并提示"已排入后台"。Windows dir→webkitGetAsEntry 覆盖缺失目录权限则提示折中改"整夹压缩上传"或退回"选夹上传"。

---

## 九、接口清单(第一期最小闭环)

### 管理端(pc/app super-admin)
```
POST /admin/org/sync               # 触发钉钉组织全量同步
GET  /admin/depts/tree             # 部门树
POST /admin/drives                 # 建空间(个人/部门) + 配额
PUT  /admin/drives/{id}            # 配额/状态
GET  /admin/users                  # 成员(按部门/关键字)
POST /admin/users/roles            # 授予/回收角色
GET  /admin/audit                  # 审计检索

# --- 空间成员细粒度权限配置(您关注的核心) ---
GET    /admin/drives/{id}/members            # 该空间成员+各自权限快照(权限码/来源角色/是否owner/manage)
POST   /admin/drives/{id}/members            # 新增/邀请成员到该空间
PUT    /admin/drives/{id}/members/{userId}/perms   # 为该成员勾选/覆盖操作权码(save 仅查看/编辑/新增/删除等,支持 FULL)
DELETE /admin/drives/{id}/members/{userId}        # 移除成员(含回收其在该空间的权限)
PUT    /admin/drives/{id}/members/{userId}/manage # 开启/关闭该成员的“空间管理权”(能否配置本空间权限/配额/回收站)
GET    /admin/perms-meta                          # 返回可用权码字典与快捷档(preview/编辑查看/等)供前端渲染勾选框
# --- 若做目录级授权(迭代) ---
GET/POST/PUT  /admin/file/{objectId}/acls         # 文件夹级按人/部门逐项授权
```

### 用户端
```
POST /auth/dingtalk                # 钉钉登录换 token
GET  /me                           # 当前用户+可见空间+配额
GET  /drives?driveType=            # 我的空间列表
GET  /file/list?parentId=&driveId= # 展开目录(分页/排序)
POST /file/mkdir                             # 同名处置见 6.0；mode=ask|autoRenumber 按场景传
POST /file/rename , /file/move , /file/copy , /file/delete(入回收站)
  # 移动/复制/上传 onConflict=ask|autoRenumber：默认 autoRenumber(批量不弹窗，见 6.0)；单次重命名/建夹走 ask
  # restore 原位置被占用 → 自动改 原(1) 放回
POST /file/upload-token   # 建占位节点并 InitiateMultipartUpload→返 {taskId, ossKey, uploadId, ...}；落名走 6.0
POST /file/quick(md5秒传) # precheck 命中→直接 complete 命中元数据
PUT  /file/upload/:taskId/sync        # 上报已传分片 ETag 与字节,刷新任务进度(可节流,亦可 listParts 校准)
GET  /file/upload/:taskId/resume      # 刷新/断点续: 校验 + OSS ListParts→只返回缺的 partNumber(断点粒度=片)
POST /file/upload/:taskId/pause | /cancel   # 暂停(paused)/取消(abort 释放配额与分片)
POST /file/upload/:taskId/complete    # 全部 part→CompleteMultipartUpload→元数据 active
GET  /file/upload/tasks?status=&page  # 任务面板: 我的进行中/可恢复/失败历史(驱动"继续/断点恢复"列表)
# 上传 token 中的 STS/单分片签名有效期、分片并发数与每片大小均为可配(见8/6.1.2)
GET  /file/:id/download-url
GET  /file/:id/preview-info          # 统一预览出口(见6.4.3): 返回 kind=doc/image/video-hls/audio + 临时URL及转码状态(queued/processing...支持轮询)
GET  /file/:id/preview-task           # 查询某文件转码/转换任务进度(前端异步轮询用)
GET  /recycle/list , POST /recycle/restore , /recycle/purge
GET  /search?q= ... &filter=type/dept/time
```

统一请求/响应：
```
{ code:0, message:"", data:{...} }
```
分页数组统一 `{ list, total, page, size }`；错误码表后续统一文档化。

---

## 十、非功能与安全

- **存储安全**：服务端不持 OSS AK 至前端，一律 STS/签名，限定 key 前缀与目录可达性，防止任意列举。
- **传输**：全 HTTPS；OSS 走私有，下载经签名 URL。
- **链接安全**：分享链接 token 随机、可过期、可撤销、可设密码/次数。
- **防越权**：目录/文件所有操作重读 drive+ACL 二次判定；前端隐藏不可见 space。
- **备份**：OSS 版本控制/跨区冗余选配；MySQL 定时备份。
- **审计**：关键写操作与下载落 `tb_audit_log`。
- **DevOps**：README + docker-compose + SQL 初始化脚本，快捷部署。

---

## 十一、里程碑建议

| 阶段 | 内容 | 产出 |
|---|---|---|
| M0 地基 | 建工程、统一规范、JWT、初始化脚本 | 可跑骨架 |
| M1 登录&组织 | 钉钉免登/扫码、同步、部门树、角色 | 可登录看到组织 |
| M2 文件&OSS | 目录树、新建/重命名/移动/删除、上传直传+秒传+**OSS 分片断点续传(后端持久化 uploadId，刷新可继续，见 6.1.2/5.6)**、下载、前端上传任务面板(进度/暂停/继续/取消，见6.1.3)；**H5 桌端拖拽(拖入上传/拖夹移动，见 8.1)** | 核心文件闭环 |
| M3 空间/权限 | 个人/部门空间、配额、**空间成员细粒度权限(权码勾选/仅查看/编辑/新增/删除/管理权)**、回收站 | MVP 可用 |
| M4 增强 | **图纸在线预览(2D CAD→svg、3D→glTF 轻量化 + 工程源/脚本查看)**、回收站、审计、搜索、管理端完整控制台 | 企业内部上线版 |
| M5 建模增强 | 图层/网格预览进阶、测量/剖切/水印禁下载、重版本漫游、Office/音视频辅助预览(如有混存) | CAD/CAM 场景完善 |

---

## 十二、待你确认/开放的决策点
1. `uni-app x` 还是 `uni-app(Vue3)`（取决于是否要求 App 端 nvue 强原生 & 既有经验）。
2. 大文件并发与网速相关要求的量级（决定拆不拆对象存储分片/CDN）。
3. 是否在内网还有独立文件网关（保留中转能力）需求。
4. ✅ **在线预览以设计文件为主，需支持 CAD 在线看图 + 3D 轻量化渲染 + 工程源/脚本查看**（路径见 6.4）。主换引擎为**自建 Job 节点**（容器化），前端矢量/glTF 渲染。
5. 🔲 **待公司选定图纸/模型转换内核**：2D DWG/DXF 导出内核（自研/开源/商业授权，需兼容图框/图层/标注）+ 3D 源件导入内核（assimp及衍生体即可覆盖多数，stp/复杂材质需评估）。选型前先给候选对比。
6. 🔲 待明确**主要来源版本与真实目录规模**：dwg 版本覆盖(AutoCAD 2000~现行)、DGN/Revit/BIM(FBX)是否也有、平均图幅/面片数、是否需要纯离线不落第三方内核。

> 建议下一步：先按 M0/M1 落「后端骨架 + 前端 request/登录 + 数据库初始化 SQL + 钉钉/OSS 对接 Demo」，跑通一次端到端登录+直传；图纸内核从 6.4 提到的「候选对比」先行评估，渲染到 M4 再做深接。
