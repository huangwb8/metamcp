# Changelog

本文件是项目变更的正式记录。凡是影响项目结构、行为、工作流或协作约定的更新，都应统一记录在这里。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

### Added（新增）

- 新增根目录 `tests/`，用于集中存放 MetaMCP 的可复用测试代码与验证夹具，方便 AI 和开发者在改动后判断项目是否仍可正常运行
- 新增根目录 `tmp/`，用于集中存放测试日志、快照、抓包和临时输出等中间文件，并明确其内容可随时删除且不影响程序正常运行
- 新增仓库级 `Vitest` 测试入口（`pnpm test` / `pnpm test:watch` / `pnpm test:coverage`），可直接从根目录运行 `tests/contracts/` 下的可复用契约测试
- 新增首批仓库级契约测试，覆盖 MetaMCP 工具命名规则、函数式中间件组合、共享 Zod 协议、前端校验翻译与共享 config router 的鉴权/输入边界
- 新增 Docker Hub 发布工作流 `.github/workflows/publish-release-images.yml`：以 GitHub Release 为发布源，支持即时触发、12 小时补偿检查、缺失标签探测和多架构镜像推送
- 新增中英文版本/镜像发布说明文档，记录 Docker Hub 变量、Secrets、标签策略与本地切换方式
- 新增操作手册 `docs/自动推送到docker-hub.md`，提供 Docker Hub token、GitHub Secrets / Variables、Release 触发与本地切换镜像的逐步配置教程
- 新增 MetaMCP 结构化活动日志字段与契约测试，可在共享日志模型中承载 `namespace/session/server/tool/duration/details` 等调用观测信息
- 新增 MCP server 实时健康状态体系：后端定时健康检查、健康结果持久化字段与前端健康状态展示，支持把“最近错误”与“当前可用性”分开表达

### Changed（变更）

- 增强 MetaMCP Live Logs 可观测性：后端统一记录 MCP `tools/list` / `tools/call` 的开始、成功、失败、耗时与参数/结果摘要，前端实时日志页面同步展示级别、事件、状态、工具名、耗时和详情，便于直接判断具体哪些 MCP 被实际激活并执行了什么
- 重构 `live-logs` 实时日志界面：按行业常见视角新增 `Error / Warning / Success / Activity / Info` 分类筛选，日志默认折叠并支持按当前筛选结果一键复制 JSON，同时移除旧版大黑框控制台样式，改为更紧凑的结构化列表排版
- 将 MCP 服务默认最大重试次数从 1 次提升到 3 次，并在连接层引入指数退避，降低冷启动时 `npx`/STDIO 服务被一次失败直接判死的概率
- 调整后端启动预热流程：等待本地健康检查通过后再预热服务池，并以分批节流方式初始化 MCP servers，减少自引用 HTTP 服务和多 STDIO 并发拉起时的竞争
- 更新 `AGENTS.md` 与 `CLAUDE.md` 协作约定，要求优先基于 `./tests` 验证改动，并将测试中间文件统一写入 `./tmp`
- 更新 `docker-compose.yml` 与 `example.env`：为应用镜像新增 `METAMCP_IMAGE` 覆盖入口，在保留 GHCR 默认值的前提下支持无侵入切换到 Docker Hub release 镜像
- 更新 `README.md`、`README_cn.md` 与 quickstart 文档：补充 Docker Hub 自动发布工作流、仓库配置要求和 compose 使用方式
- 更新 `live-logs` 页面展示逻辑：除原始消息外，现可直接查看 MCP 激活、工具调用状态、工具名、耗时、会话/命名空间以及结构化 details
- 更新 `mcp-servers` / `namespaces` 页面与 MetaMCP 聚合筛选逻辑：当前可连通性改为以 `health_status` 为准，原有 `error_status` 继续保留为故障痕迹与人工恢复语义

### Fixed（修复）

- 修复 MetaMCP 会把大量普通 `STDIO stderr` 内容直接记为 `error` 的问题；现在普通 `stderr` 会作为独立 `stderr` 日志语义展示并默认降为 warning，真正的启动失败/连接异常仍保持 `error`，从而降低 Live Logs 假阳性并保留排障信息
- 修复 OpenAPI MCP 执行链路中的日志缺口与变量引用问题；之前部分工具执行和 OpenAPI 会话激活只写入文件日志或存在未定义 `serverUuid`，导致 Live Logs 看不到完整执行过程
- 修复 MCP server `ERROR` 状态会被数据库残留值永久锁死的问题；现在重启后允许自动再次尝试，成功连接会自动清除错误状态
- 修复 MCP server 错误状态恢复链路不完整的问题；新增服务级手动重试接口和前端入口，无需再手动改数据库才能触发恢复
- 修复 backend `vitest` 未解析 `@/` 路径别名导致测试无法运行的问题
- 修复 `@repo/trpc` 在生成声明文件时无法解析 workspace `@repo/zod-types` 类型的问题，恢复共享路由包的稳定构建
- 修复 Docker 镜像 OCI 元数据仍硬编码指向上游仓库的问题，改为支持按当前 fork 注入正确的 source/vendor 信息
- 修复 MetaMCP `live-logs` 无法判断 MCP 是否实际被调用的问题；现在会为连接、session 激活、`tools/list`、`tools/call`、成功/失败和错误产出可追踪日志
- 修复 `mcp-servers` 里的 `error_status` 不能真实反映 MCP 服务当前可用性的问题；现在后台会自动探测并持久化健康结果，前端连接与工具管理也不再误把历史错误位当成实时在线状态

## [1.0.0] - 2026-03-21

### Added（新增）

- 初始化 AI 协作基础文档：`AGENTS.md`、`CLAUDE.md`、`CHANGELOG.md`
- 为本仓库建立面向独立 fork 二次开发的协作规范
- 记录 monorepo 结构、常用命令、跨包联动与验证约定

### Changed（变更）

- 明确默认目标是服务当前 fork 的持续开发，而不是面向上游仓库整理 PR
- 保留现有 `README.md` 与 `.gitignore`，避免覆盖上游项目说明与现有忽略规则

### Fixed（修复）

- 修正自动初始化模板从上游 `README.md` 误读项目名称与描述的问题

---

## 记录规范

以下变更应及时写入本文件：

- `AGENTS.md`、`CLAUDE.md` 的修改
- 目录结构和关键文件调整
- 影响行为的配置、依赖、接口或部署变更
- 用户可感知的功能新增、修复和回归处理
- 开发流程、测试约定或版本策略的变动

记录要求：

- 写清变更内容、原因和影响范围
- 优先描述真实的用户影响或开发影响
- 发布时把 `[Unreleased]` 整理为正式版本条目
