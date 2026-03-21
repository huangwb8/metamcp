# MetaMCP Fork - Claude Code 项目指令

## 核心指令

@./AGENTS.md

## Claude Code 特定说明

### 文件引用规范

在 Claude Code 中引用文件时，使用 markdown 链接语法：
- 文件：`[filename.md](路径/filename.md)`
- 特定行：`[filename.md:42](路径/filename.md#L42)`
- 目录：`[目录名/](路径/目录名/)`

### 任务管理

- 多文件或跨包任务使用 TodoWrite 跟踪进度。
- 默认按“独立 fork 开发”理解任务，不以向上游 PR 为目标。
- 变更如果跨越 backend、frontend 与共享包，优先拆成可验证的小步骤。

### 代码变更规范

- 修改前先阅读入口文件和直接依赖文件。
- 优先使用精确修改，避免无关重排与大范围格式化。
- 完成后至少运行与改动范围匹配的检查或测试。

### 与 AGENTS.md 的关系

- `AGENTS.md` 是跨平台通用项目指令，也是唯一需要持续维护的事实来源。
- `CLAUDE.md` 通过 `@./AGENTS.md` 自动引用核心规则，仅补充 Claude Code 特定说明。
- 修改 `AGENTS.md` 后，应同步在 `CHANGELOG.md` 记录原因和影响。
