# Akeso API Contract (v2)

## Dietary Safety Semantics

- `UserProfile.dietarySafety` stores user-reported food allergies and avoid-list items. It is collected during onboarding and returned by `GET /v1/profile`.
- `dietarySafety.allergens` is a controlled enum: `peanuts`, `tree_nuts`, `milk`, `eggs`, `soy`, `wheat_gluten`, `fish`, `shellfish`, `sesame`.
- `dietarySafety.avoidIngredients` is free text for foods the user wants Akeso to avoid. Each item is capped at 80 characters; the list is capped at 20 items.
- `FridgeItem.allergenTags` and `MealRecommendation.allergenTags` use the same allergen enum. They are data tags, not medical certification.
- `GET /v1/nutrition/:date` filters out meal recommendations whose `allergenTags` match the saved profile allergens, or whose title/description/tags contain a saved avoid-list item.
- A non-empty `dietarySafety.notes` value is an additional safety requirement that cannot be structurally verified. The API returns no meal recommendations and explains that a manual check is required.
- If no meal recommendation remains after filtering, App UI should show an empty safety state instead of silently hiding the section.
- Dietary safety does not affect `EnergyResult.score`, `EnergyResult.factors`, or the Energy Engine. It only gates food suggestions.
- Akeso must not claim that a meal is clinically safe. UI and coach copy should keep the safer position: suggestions are based on user-provided restrictions, and users should still check labels and professional advice for severe allergies.

对应 Issue #6。**冻结规则**:本文件与 `packages/contracts`(`@akeso/contracts`,含 Zod 运行时校验)、`packages/domain/src/service.ts` 共同构成共享契约。修改任何字段都需要全部模块负责人同意(TEAM_CONTRACT §2)。

## 原则

- App 只通过 `AkesoService` 接口(`packages/domain/src/service.ts`)取数据,接口方法与 HTTP 端点 1:1 对应;
- `FixtureService`(现在)和 `ApiService`(集成后)必须返回**完全相同的结构**,页面在切换时零改动;
- 所有响应使用统一 envelope;所有类型定义以 `@akeso/contracts` 为唯一权威(`@akeso/domain` re-export 同一份类型,App/API 现有导入不受影响),后端不得另行定义;
- Energy Score 只由后端 `EnergyEngine` 计算,App 不做任何权威计算(TEAM_CONTRACT §4.1)。

## 响应 Envelope

```jsonc
// 成功
{ "success": true, "data": { /* 类型见下表 */ } }
// 失败
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

## 端点一览

| Service 方法 | HTTP 端点 | 请求体 | data 类型 | 页面 |
|---|---|---|---|---|
| `getProfile()` | `GET /v1/profile` | — | `UserProfile \| null` | 全部 |
| `saveProfile(p)` | `PUT /v1/profile` | `UserProfile` | `UserProfile` | Onboarding |
| `submitCheckIn(input)` | `POST /v1/checkins` | `CheckInInput` | `EnergyResult` | Check-in |
| `getTodayEnergy(date)` | `GET /v1/energy/:date` | — | `EnergyResult \| null` | Dashboard |
| `replayEnergy(date)` | `GET /v1/energy/:date/replay` | — | `EnergyResult` | Audit / diagnostics |
| `saveEnergyCalibration(date, actualEnergy)` | `PUT /v1/energy/:date/calibration` | `{ actualEnergy: 1..5 }` | `EnergyCalibration` | Dashboard |
| `getTasks(date)` | `GET /v1/tasks?date=` | — | `Task[]` | Plan |
| `getTodayPlan(date)` | `GET /v1/plan/:date` | — | `DayPlan \| null` | Plan / Dashboard |
| `updatePlanBlock(date, blockId, input)` | `PATCH /v1/plan/:date/blocks/:blockId` | `{ title, start, end, status }` | `DayPlan` | Plan |
| `regeneratePlan(date, instruction?)` | `POST /v1/plan/:date/regenerate` | `{ "instruction"?: string }` | `{ plan: DayPlan, coach: CoachReply }` | Plan |
| `getNutritionPlan(date)` | `GET /v1/nutrition/:date` | — | `NutritionPlan \| null` | Nutrition / Dashboard |
| `regenerateNutrition(date)` | `POST /v1/nutrition/:date/regenerate` | — | `NutritionPlan` | Nutrition |
| `getCoachReply(date)` | `GET /v1/coach/:date` | — | `CoachReply` | Dashboard / Plan |
| `getFridgeItems()` | `GET /v1/fridge` | — | `FridgeItem[]` | Nutrition |
| `saveFridgeItem(item)` | `PUT /v1/fridge/:id` | `Omit<FridgeItem, 'id'>` | `FridgeItem` | Nutrition |
| `deleteFridgeItem(id)` | `DELETE /v1/fridge/:id` | — | `null` | Nutrition |
| `saveFridgeItemsBatch(items)` | `POST /v1/fridge-items/batch` | `{ items: FridgeItem[] }` | `FridgeItem[]` | Nutrition |
| `recognizeFridgeImage(image)` | `POST /v1/fridge/recognitions` | multipart `image` | `IngredientRecognitionResult` | Nutrition |
| `extractReportMetrics(image)` | `POST /v1/reports/extractions` | multipart `image` | `ReportExtractionResult` | Reports |
| `getReports()` | `GET /v1/reports` | — | `HealthReport[]` | Reports |
| `saveReport(input)` | `POST /v1/reports` | `CreateReportRequest` | `HealthReport` | Reports |
| `getReport(id)` | `GET /v1/reports/:id` | — | `HealthReport` | Report detail |
| `updateReport(id, input)` | `PATCH /v1/reports/:id` | `{ name?, reportDate? }` | `HealthReport` | Report detail |
| `updateReportMetrics(id, input)` | `PATCH /v1/reports/:id/metrics` | `{ metrics: ReportMetric[] }` | `HealthReport` | Report detail |
| `deleteReport(id)` | `DELETE /v1/reports/:id` | — | `null` | Report detail |
| `getReportRecommendations(id)` | `GET /v1/reports/:id/recommendations` | — | `HealthRecommendationSet` | Report detail |
| `regenerateReportRecommendations(id)` | `POST /v1/reports/:id/recommendations/regenerate` | — | `HealthRecommendationSet` | Report detail |
| `getReminderPreference()` | `GET /v1/reminders` | — | `ReminderPreference \| null` | (无,持久化先行于 UI) |
| `saveReminderPreference(p)` | `PUT /v1/reminders` | `ReminderPreference` | `ReminderPreference` | (无,持久化先行于 UI) |

`date` 一律为本地日期 `YYYY-MM-DD`。鉴权:除 Onboarding 前的注册/登录外,所有端点要求 Supabase Auth Bearer token(登录端点由 API 组在 v1.1 补充,不影响以上结构)。

## 语义约定

- `GET /v1/energy/:date` 在**未签到**时返回 `data: null`(HTTP 200),App 以此判断是否显示 Check-in 引导;`getTodayPlan` 同理;
- `POST /v1/checkins` 同日重复提交 = 覆盖更新,返回重新计算的 `EnergyResult`;
- `PATCH /v1/plan/:date/blocks/:blockId` 只允许修改标题、开始/结束时间与完成状态；首次更新保存原始建议，重叠时段返回 `VALIDATION_ERROR`，且不得修改 Energy score、预测能量或推荐理由；
- `POST /v1/plan/:date/regenerate` 保留 `source: "user"` 的块，并移除与其重复或重叠的新建议；
- v2 `role: 'scored_signal'` 因子均带有整数 `impact`;历史 v1 的 `reported_energy` / `possible_context` 结构仍可读取;
- `not_sure` 或缺失信号不产生正负影响,只降低 `confidence`,不得被推断为负面状态;
- `algorithmVersion`、`confidence`、`personalBaseline`、`baselineDelta` 与 `baselineExplanation` 必须随结果持久化;
- `GET /v1/energy/:date/replay` 使用已存结果的 `algorithmVersion` 只读回放,不得改写原结果;
- 校准只参与未来日期的个人 baseline,不得回写或改变当天已存 score;
- `CoachReply.disclaimer` 必须始终返回非空(产品诚信要求,TEAM_CONTRACT §10);
- `MealRecommendation.usesFridgeItemIds` 引用同一响应内 `NutritionPlan.fridge[].id`;
- `PUT /v1/fridge/:id` 以路径 `id` 为准做 upsert(同一 id 重复提交 = 覆盖,幂等);库存仅表达“有这个食物”,不含数量、单位、克数或到期日;
- `POST /v1/fridge/recognitions` 只返回候选,绝不自动写库存;候选默认未确认,客户端只把用户最终勾选的项目发送到 batch 接口;
- 图片只在内存中处理,限制 5 MiB,校验 JPEG/PNG/WebP 文件签名,不写 Supabase、磁盘或日志;
- 报告识别图片同样只在内存中处理且不持久化；`HealthReport` 保存报告名称、报告日期以及全部已审阅指标（包括低置信度/未确认字段），从而支持保存后修正；至少一项指标必须确认;
- `PATCH /v1/reports/:id/metrics` 是完整替换。API 不信任客户端 `status`，会按修正后的数值与该报告自身参考范围重新计算，并使旧建议缓存失效;
- 报告建议只能接收当前 `confirmed: true` 的指标；未确认字段不得进入 AI 输入、fallback、引用 ID 或展示证据。每条建议至少引用一个同一响应 `metrics` 中的 ID，App 展示该服务端证据的指标名称、结果和单位;
- 报告建议可读取的用户资料严格限定为 `goal`、`typicalWake`、`typicalSleep`、`dietaryPreference` 四个结构化字段。`displayName`、过敏备注、避免食材和其他自由文本不得进入建议 Prompt；资料上下文属于 cache key，资料或指标变化后旧缓存不得继续命中;
- 建议 Provider 只能看到 `metric_1` 形式的不透明引用与服务端计算的 `status`，看不到真实指标 ID、名称、结果、单位或报告文本。Provider 只返回闭集 action code + 不透明引用；服务端映射回当前已确认 metric ID，并以固定模板渲染所有可见文案;
- 所有按报告 id 的读取、修改、建议和删除操作均按当前认证用户查询；他人的 id 统一返回 `NOT_FOUND`。删除报告同时删除结构化指标与派生建议缓存。原始图片从未落盘，因此没有遗留文件对象;
- `GET /v1/nutrition/:date` 读取真实 profile、energy 和确认库存,返回匹配缓存或即时确定性 fallback;`regenerate` 才调用 AI。AI 与 fallback 都必须通过 `NutritionPlanSchema`,且餐食只能引用响应内真实库存 ID;

AI nutrition providers return a private, text-free blueprint made from confirmed
inventory IDs and a closed cooking-action enum. The API renders the public
`NutritionPlan` from those IDs, so provider-supplied food prose cannot reach the
client. Dietary filtering is deliberately conservative because `FridgeItem`
stores only a broad category: it cannot distinguish plant from animal protein,
gluten-free grains, halal-compliant protein, or the contents of `other` items.
- `GET /v1/reminders` 在未设置时返回 `data: null`(HTTP 200);`ReminderPreference` 尚无消费方 UI,是提前持久化的数据层;
- 错误码:`UNAUTHORIZED`、`VALIDATION_ERROR`、`INVALID_IMAGE`、`AI_UNAVAILABLE`、`AI_TIMEOUT`、`MALFORMED_AI_OUTPUT`、`REPORT_CHANGED`、`NOT_FOUND`、`RATE_LIMITED`、`INTERNAL`。`REPORT_CHANGED` 表示建议生成期间报告指标或允许使用的资料上下文已被修改，客户端应重新加载或重试生成。

## Energy Score 计算语义

Akeso v2 是确定性、可解释的 **personal energy estimate**，不是临床量表或诊断。`EnergyEngine` 是唯一数值权威；生成式 AI 只可在数值计算完成后解释已存结果，绝不能生成、修改、校准或覆盖 score。

### 版本化输入与权重

`energy-v2-multisignal` 从中性 60 分开始，加入下列版本化信号：

| 信号 | v2 最大作用 | 缺失 / `not_sure` |
|---|---:|---|
| 个人历史 baseline | -40..+40 | 历史不足 3 天使用安全 cold start 60 |
| `reportedEnergy` | -24..+24 | 必填 |
| `sleepDuration` | -14..+5 | 0，降低 confidence |
| `lastMealTiming` | -12..+4 | 0，降低 confidence |
| `hydration` | -10..+3 | 0，降低 confidence |
| `localHour` 时间节律 | -8..+4 | 0，降低 confidence |

所有权重、边界与曲线 offset 位于同一个带版本配置中。最终 score clamp 到 0–100。每个已知信号返回 `role: "scored_signal"` 的 signed `impact` 与保守解释；UI 展示主要正负因素。冲突信号不会被隐藏，而是降低 `confidence`。

`localHour` 由 App 在签到开始时捕获并作为显式 0–23 整数发送。Domain 不读取系统时钟，因此同输入、同历史、同算法版本必须返回字节级相同结果。旧客户端缺少此字段时采用中性影响。

### 个人 baseline 与校准

- Domain 只读取当前用户、签到日期之前、最多 28 条历史；
- 3 条之前为 `source: "cold_start"`；达到 3 条后使用历史自评；
- 后续 `EnergyCalibration.actualEnergy` 权重高于当天初始自评，并标记 `source: "calibrated"`；
- 校准只改变未来 baseline；历史 `EnergyResult` 保持不可变；
- `baselineDelta = score - personalBaseline.score`，`baselineExplanation` 说明今天为何高于或低于平时。

### 缺失、安全与回放

`reportedEnergy` 必须是整数 1–5；其余枚举和 `localHour` 由严格 Zod schema 校验。`not_sure` 不产生 factor，不得被推断为睡眠差、未进食或缺水。低覆盖率使用保守 headline。

`lastMealDescription` 是不可信自由文本（最多 280 字符），不参与评分；消费者只能把它当纯数据，不能作为指令或 HTML/Markdown。

每个结果保存 `algorithmVersion` 和当时的 `personalBaseline` 快照。回放端点按已存版本与 baseline 快照选择引擎，因此之后补录校准也不能改写旧结果；未知版本失败关闭。`energy-v1-self-report` 仍保留原 1→20、2→40、3→60、4→80、5→100 的自评映射，保证历史解释与审计。

### 能量曲线与离线评估

`EnergyResult.curve` 由最终 score 加当前算法版本的固定日内 offset 得出。`npm run energy:eval` 对版本控制的六类虚构校准样本输出 MAE、10 分内命中率、band accuracy 和平均 confidence，作为后续调权的可复现基线；不读取生产健康数据。

## UI 页面 → 数据依赖(契约提取来源)

| 页面 | 依赖 |
|---|---|
| Welcome / Onboarding | `saveProfile` |
| Daily Check-in | `submitCheckIn(CheckInInput) → EnergyResult` |
| Dashboard(主页) | `EnergyResult`(score/band/headline/factors/curve/peak/dip)+ `NutritionPlan`(needs 前 2 + meals[0])+ `CoachReply`(compact) |
| Today's Plan | `DayPlan.blocks[]` + `CoachReply` + `updatePlanBlock` + `regeneratePlan` |
| Nutrition | `NutritionPlan`(needs/fridge/meals/rationale) |

## 后端待办(从契约出发)

1. Express 路由骨架 + Zod 验证(shape 直接从 `@akeso/domain` 派生);
2. Supabase 表:`checkin`、`energy_result`、`task`、`plan_block`(+ `fridge_item`、`nutrition_*` 视 P1 而定)以 Migration 提交;
3. `EnergyEngine` / `PlannerService` 纯 TS 实现(Domain 负责人,单测 ≥80%);
4. 用 `packages/domain/src/fixtures.ts` 作为 Demo 种子数据,保证前后端切换前后画面一致。
