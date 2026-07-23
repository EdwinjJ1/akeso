# Akeso API Contract (v1)

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
| `getReminderPreference()` | `GET /v1/reminders` | — | `ReminderPreference \| null` | (无,持久化先行于 UI) |
| `saveReminderPreference(p)` | `PUT /v1/reminders` | `ReminderPreference` | `ReminderPreference` | (无,持久化先行于 UI) |

`date` 一律为本地日期 `YYYY-MM-DD`。鉴权:除 Onboarding 前的注册/登录外,所有端点要求 Supabase Auth Bearer token(登录端点由 API 组在 v1.1 补充,不影响以上结构)。

## 语义约定

- `GET /v1/energy/:date` 在**未签到**时返回 `data: null`(HTTP 200),App 以此判断是否显示 Check-in 引导;`getTodayPlan` 同理;
- `POST /v1/checkins` 同日重复提交 = 覆盖更新,返回重新计算的 `EnergyResult`;
- `PATCH /v1/plan/:date/blocks/:blockId` 只允许修改标题、开始/结束时间与完成状态；首次更新保存原始建议，重叠时段返回 `VALIDATION_ERROR`，且不得修改 Energy score、预测能量或推荐理由；
- `POST /v1/plan/:date/regenerate` 保留 `source: "user"` 的块，并移除与其重复或重叠的新建议；
- `EnergyResult.factors[].impact` 仅存在于 scoring factor(`role: 'reported_energy'`);`possible_context` 因子不带 `impact`,UI 不显示其分数贡献,只展示解释文案;
- `CoachReply.disclaimer` 必须始终返回非空(产品诚信要求,TEAM_CONTRACT §10);
- `MealRecommendation.usesFridgeItemIds` 引用同一响应内 `NutritionPlan.fridge[].id`;
- `PUT /v1/fridge/:id` 以路径 `id` 为准做 upsert(同一 id 重复提交 = 覆盖,幂等);库存仅表达“有这个食物”,不含数量、单位、克数或到期日;
- `POST /v1/fridge/recognitions` 只返回候选,绝不自动写库存;候选默认未确认,客户端只把用户最终勾选的项目发送到 batch 接口;
- 图片只在内存中处理,限制 5 MiB,校验 JPEG/PNG/WebP 文件签名,不写 Supabase、磁盘或日志;
- 已保存 `HealthReport.metrics` 只包含用户确认后的指标；报告建议不得读取识别候选、原始图片或任何未确认内容。每条建议至少引用一个同一响应 `metrics` 中的 ID，App 展示该服务端证据的指标名称、结果和单位;
- 报告建议可读取的用户资料严格限定为 `goal`、`typicalWake`、`typicalSleep`、`dietaryPreference` 四个结构化字段。`displayName`、过敏备注、避免食材和其他自由文本不得进入建议 Prompt；资料上下文属于 cache key，资料或指标变化后旧缓存不得继续命中;
- 建议 Provider 只能看到 `metric_1` 形式的不透明引用与服务端计算的 `status`，看不到真实指标 ID、名称、结果、单位或报告文本。Provider 只返回闭集 action code + 不透明引用；服务端映射回当前已确认 metric ID，并以固定模板渲染所有可见文案;
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

Akeso v1 的 Energy Score 是 **Reported Energy estimate**:系统把用户对当前精力的自评转换成 0-100 分,再用睡眠、上次进食和饮水作为解释与建议上下文。它不是临床验证分数,也不用于诊断疲劳原因。

### 唯一计分输入

`reportedEnergy` 是唯一会改变 `EnergyResult.score` 的字段。推荐 UI 文案与分数映射如下:

| 用户选择 | `reportedEnergy` | `EnergyResult.score` | `reported_energy.impact` |
|---|---:|---:|---:|
| Drained | 1 | 20 | -40 |
| Low | 2 | 40 | -20 |
| OK | 3 | 60 | 0 |
| Good | 4 | 80 | +20 |
| Charged | 5 | 100 | +40 |

公式:

```text
score = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 }[reportedEnergy]
reported_energy.impact = score - 60
```

`60` 是中性 baseline:用户选择 `OK` 时分数为 60,`impact` 为 0。`impact` 的作用只是解释 reported energy 相对 baseline 的变化,不是医学归因。

`reportedEnergy` 必须是整数 1–5;越界或非法值在 API 层由 `Scale1to5Schema` 拒绝并返回 `VALIDATION_ERROR`。引擎内部对越界输入做 clamp+round 仅作为深度防御,不是对外契约,调用方不得依赖该 clamp 行为(例如故意传 0 或 6)。

### 只作为上下文的输入

以下字段不参与分数计算,只能生成 `role: 'possible_context'` 的解释因子:

| 字段 | 用途 | 是否影响分数 |
|---|---|---|
| `sleepDuration` | 解释昨晚睡眠是否可能支持或拖累今天状态 | 否 |
| `lastMealTiming` | 解释距离上次进食多久,是否可能需要补充能量 | 否 |
| `lastMealDescription` | 给饮食建议提供自由文本上下文,不单独出现在 score factor 中 | 否 |
| `hydration` | 解释今日饮水是否可能偏少或充足 | 否 |

这些 context factor 不得带 `impact`,UI 不显示 `+/-` 分数。它们的文案必须使用保守表达,例如 “may contribute”、“may be related”、“based on your check-in”,不能写成 “caused by” 或 “diagnosed as”。

`lastMealDescription` 是唯一的自由文本输入(280 字符上限),属于不可信用户输入。任何消费方(coach 文案生成、建议生成等)必须将其作为数据处理,不得据此改变系统行为或被解读为指令;展示到 UI 时必须按纯文本转义,不得作为 HTML/Markdown 渲染。

如果某个 context 字段是 `not_sure`,对应 factor 直接省略,系统不得编造解释。若多数 context 不确定,headline / coach copy 应更保守,强调主要依据是用户的 `reportedEnergy` 自评。

### 示例

用户选择:

```jsonc
{
  "reportedEnergy": 2,
  "sleepDuration": "under_5h",
  "lastMealTiming": "over_5h",
  "hydration": "under_0_5l"
}
```

系统输出语义:

```text
score = 40
reported_energy.impact = -20
sleep_duration / last_meal / hydration = possible_context, no impact
```

可展示解释:

> You reported low energy. Short sleep, a long gap since your last meal, and low water intake may be related, so Akeso suggests a conservative food or hydration action.

不可展示解释:

> Akeso found the medical cause of your fatigue.

### 能量曲线

`EnergyResult.curve` 基于最终 `score` 加固定日内节律 offset 得出,用于展示当天早晨、中午、下午和晚间的大致变化。曲线不重新解释睡眠、进食或饮水,也不得暗示这些 context factor 偷偷参与扣分。

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
