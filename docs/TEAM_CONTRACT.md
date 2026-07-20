# Akeso 团队协作契约

版本：1.0  
生效日期：2026 年 7 月 20 日  
适用范围：ICON UNSW × Lyra Hackathon 提交截止前的全部团队工作。

## 1. 共同目标

团队将在 **7 月 21 日 18:00（AEST）前**完成一条可运行的核心流程：

`20 秒每日签到 → 可解释的 Energy Score → 能量感知日程 → 有数据依据的 AI 教练建议`

团队将在 **7 月 22 日 20:00（AEST）前**完成所有提交材料：

- 可正常访问的 Web 版本；
- Android 安装包或可安装开发版本；
- 完整源代码；
- 清晰的 README；
- 演示幻灯片；
- 3–5 分钟 Demo 视频；
- 可量化的节省时间证据。

7 月 22 日 20:00 至 23:59 之间的时间只用于处理上传失败、部署问题和严重缺陷，不再开发新功能。

Akeso 的产品定位是**个人能量教练**，不是医疗设备。产品不得诊断疾病、开具治疗方案或宣称具有临床准确性。

## 2. 信息来源优先级

当不同信息发生冲突时，按以下优先级执行：

1. [`docs/architecture.html`](./architecture.html)：产品范围、系统边界、数据流和技术架构；
2. GitHub Project Board：当前优先级、负责人、状态和截止时间；
3. GitHub Issue：验收标准和具体实现要求；
4. Pull Request：代码变更、验证方法和已知限制；
5. 群聊或私聊：只用于讨论，最终决定必须同步到对应的 Issue 或 PR。

修改以下内容前，必须获得所有受影响模块负责人的同意，并在相关 Issue 中记录决定：

- API 接口；
- 共享类型；
- 数据库 Schema；
- MVP 范围；
- 核心 Demo 流程。

## 3. 四个主要角色

每位成员选择一个主要角色，同时可以 Review 其他模块。模块负责人负责协调结果，不代表所有代码都必须由负责人独自完成。

| 角色 | 负责范围 | 必须交付 | 默认 Reviewer |
|---|---|---|---|
| **产品与 App 体验** | Energy First 首页、Expo Router 页面、设计系统、签到交互、Dashboard 和无障碍体验 | 可点击的完整核心流程；Web 与移动端响应式 UI；加载、空数据和错误状态 | 集成、QA 与 Demo |
| **API 与数据** | Express API、Supabase Auth/Postgres、Repository、输入验证和环境配置 | 稳定接口；数据库 Schema 或 Migration；Demo 种子数据；API 错误处理 | Domain 与 AI |
| **Domain 与 AI** | 共享领域类型、`EnergyEngine`、`PlannerService`、`CoachService`、Prompt 和结构化 AI 输出 | 确定性评分；因子解释；日程生成；安全且有依据的 AI 建议；单元测试 | API 与数据 |
| **集成、QA 与 Demo** | 端到端集成、构建、部署、回归测试、节时测量、幻灯片和视频 | Web 地址；Android 构建；E2E 演示脚本；时间证据表；全部提交材料 | 产品与 App 体验 |

在分配 Issues 前，四位成员必须各自确认一个主要角色，任何角色都不能无人负责。

在团队另行指定之前，GitHub 仓库所有者担任 Release Coordinator，负责集成、版本冻结和截止时间取舍。

## 4. 模块边界

项目按照以下接口边界并行开发。

### 4.1 App 模块

- 从 API Client 接收有类型定义的 `EnergyResult` 和 `DayPlan`；
- 页面内部不得计算权威 Energy Score；
- 不得直接调用 Claude，也不得存放任何 AI API Key；
- API 未完成时，可以使用符合共享类型的 Fixture 数据开发 UI；
- Fixture 与真实 API 必须返回相同的数据结构。

### 4.2 API 模块

- 所有请求必须先验证，再调用 Domain Service；
- 负责鉴权、持久化、HTTP 状态码和统一错误结构；
- Controller 中不得包含评分权重或任务安排规则；
- 使用真实 Service 和 Stub Service 时必须保持相同的返回结构；
- 不得把 Supabase Service Role Key 暴露给客户端。

### 4.3 Domain 模块

- `EnergyEngine` 和 `PlannerService` 必须是纯 TypeScript 模块；
- Domain 模块不得导入数据库、网络或 UI 代码；
- 确定性引擎负责 Energy Score、影响因子和任务安排限制；
- AI 可以解释已有结果，或在给定限制内调整计划；
- AI 不得自行生成权威 Energy Score；
- AI 的结构化输出必须通过 Schema 验证后才能发送给 App。

### 4.4 Data 模块

- 用户身份由 Supabase Auth 管理；
- MVP 包含四张业务表：`checkin`、`energy_result`、`task` 和 `plan_block`；
- 数据库变更必须通过提交到仓库的 Migration 或 Schema 文件记录；
- 禁止只在 Supabase Dashboard 中修改而不保留代码记录；
- Demo Fixture 必须使用虚构数据，不得使用团队成员的真实健康信息。

## 5. Git 与 Pull Request 工作流

- `main` 分支必须始终保持可演示状态；
- `main` 不可演示时视为最高优先级事故：15 分钟内无法修复就立即 revert，由合并该 PR 的成员负责跟进修复；
- 所有开发均在短期功能分支上完成；
- 分支命名格式为 `<type>/<issue>-<slug>`，例如 `feat/12-daily-checkin`；
- 每个 Issue 只能有一名最终负责人和一名 Reviewer；
- 每个人同一时间最多只能有一个 Issue 处于 **In Progress**；
- 一个 PR 原则上只解决一个 Issue；
- 除生成文件外，一个 PR 通常不应超过 400 行变更；
- UI 变更必须在 PR 中提供截图或录屏；
- PR 描述必须包括关联 Issue、变更内容、验证方式和已知限制；
- 合并前至少需要另一位成员 Review；
- 截止时间前的紧急合并可以先合并，但必须由第二位成员立即进行验证；
- 使用 Squash Merge；
- 未经允许不得 Force Push 共享分支，也不得重写其他成员的提交历史。

禁止提交以下内容：

- `.env` 文件；
- API Key；
- Supabase Service Role Key；
- Android 或 iOS 签名凭据；
- 真实个人健康数据；
- 不需要纳入版本管理的生成文件和构建产物。

Commit Message 使用 Conventional Commits：

```text
feat: add daily energy check-in
fix: validate coach response schema
test: cover low-sleep score factors
docs: add demo timing evidence
```

## 6. Issue 工作流

Board 状态为：

`Backlog → Ready → In Progress → Review → Done`

无法在截止前完成、并被团队明确移出 MVP 的任务进入 **Cut**。

Issue 只有满足以下条件才能进入 **Ready**：

- 只描述一个明确结果；
- 已指定负责人和 Reviewer；
- 已标记 `P0`、`P1` 或 `P2`；
- 预估时间为一小时、两小时或三小时；
- 已写明依赖关系；
- 已写明可测试的验收标准；
- 已说明需要提交的 Demo Evidence。

预计超过三小时的任务必须先拆分，不能直接进入 **In Progress**。

## 7. Definition of Done

一个 Issue 只有满足以下全部条件才能标记为 **Done**：

- 所有 Acceptance Criteria 均已通过；
- TypeScript、Lint 和相关测试通过；
- Domain 相关 Issue：包含单元测试，且 `EnergyEngine` 与 `PlannerService` 覆盖率不低于 80%；
- 其他 Issue：不得降低现有测试覆盖率；
- 已处理加载、无效输入和服务失败状态；
- 不包含密钥或个人健康数据；
- 已由另一位成员完成 Review；
- 已合并到 `main`；
- 合并后核心端到端 Demo 仍然可用；
- Issue 中包含截图、录屏、API Response、测试输出或部署链接作为证据。

## 8. 沟通与交接

- 实现相关问题写在 Issue 中；
- 代码相关讨论写在 PR 中；
- 出现 Blocker 时必须立即说明：被什么阻塞、已经尝试什么、需要谁协助、最晚何时决定；
- 工作交接必须包含分支或 PR、当前状态、运行方式、剩余工作和已知问题；
- 团队每天在 **13:00、18:00 和 21:00（AEST）**进行集成检查；
- 每次集成检查前，所有成员必须先更新 Board；
- 如果聊天中的决定会改变范围或接口，必须先同步到相关 Issue，再继续开发。

## 9. 范围和截止时间规则

- **P0**：保护核心 Demo 和强制提交要求，必须完成；
- **P1**：只在完整核心流程已经运行于 `main` 后开始；
- **P2**：黑客松结束后再做，不得占用提交前时间；
- 7 月 21 日 18:00 时，尚未完成的 P0 必须缩减成最小可运行版本；
- 7 月 22 日 12:00 后，未经四人一致同意不得开始任何新功能；
- 外部依赖威胁 Demo 时，优先保持接口不变，并使用有类型定义的 Fixture 或确定性 Fallback；
- Web 与原生端行为冲突时，优先保护评审时使用的 Demo 路径，并在 README 中记录限制。

## 10. 安全与产品诚信

- AI 文案使用“可能”“建议”“根据今天的签到”等非确定性表达；
- Akeso 不得把输出描述为诊断、治疗或专业医疗建议；
- AI 输出必须建立在已经计算的影响因子和当前日程之上；
- 只收集实现功能所必需的数据；
- 用户应当知道数据为什么被收集和存储；
- Demo 必须清晰区分设备测量值、用户自报值和系统估算值；
- 节省时间的声明必须包含原工作流、Akeso 工作流、计算假设和测量或估算的分钟数。

## 11. 冲突解决

1. 技术分歧优先依据架构、Acceptance Criteria 和最快可验证实验解决；
2. 在既定接口内，由相关模块负责人决定实现细节；
3. Release Coordinator 决定截止时间和集成方面的取舍；
4. 修改产品承诺或删除 P0 功能，需要至少四人中的三人同意；
5. 安全、隐私和密钥管理规则不能以赶时间为理由取消。

## 12. 团队承诺

领取 Issue 即代表成员同意：

- 及时维护任务状态；
- 尽早暴露 Blocker；
- 遵守模块接口；
- 及时 Review 队友的工作；
- 优先保证团队拥有一条完整、有说服力的 Demo，而不是四个彼此割裂的功能。

## 13. 共享基础设施与账号归属

所有部署与外部服务必须登记归属，避免关键时刻单点失联。Owner 在 Demo 前 24 小时内必须保持可联系；每项资源至少一名备份成员拥有访问权限。密钥只存放在各自环境的 `.env` 中，不入仓库。

| 资源 | 用途 | Owner | 备份访问 |
|---|---|---|---|
| GitHub 仓库 + Project Board | 代码、Issue、Board | （填写） | 全员 |
| Vercel | Web 前端 + Express API 部署（免费 Hobby 档） | （填写） | （填写） |
| Supabase 项目 | Auth + Postgres | （填写） | （填写） |
| Expo / EAS 账号 | Android 构建（EAS Build）与真机预览（Expo Go） | （填写） | （填写） |
| Claude API Key | AI 教练调用 | （填写） | （填写） |

托管方案：Web 与 API 统一部署在 Vercel（API 以 Serverless 方式运行，状态全部存于 Supabase）；Android 安装包由 EAS Build 云端构建。若 Vercel 出现问题，备选方案为 Render（注意免费档休眠，Demo 前需预热）。
