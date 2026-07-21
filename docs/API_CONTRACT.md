# Akeso API Contract (v1)

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
| `regeneratePlan(date, instruction?)` | `POST /v1/plan/:date/regenerate` | `{ "instruction"?: string }` | `{ plan: DayPlan, coach: CoachReply }` | Plan |
| `getNutritionPlan(date)` | `GET /v1/nutrition/:date` | — | `NutritionPlan \| null` | Nutrition / Dashboard |
| `getCoachReply(date)` | `GET /v1/coach/:date` | — | `CoachReply` | Dashboard / Plan |

`date` 一律为本地日期 `YYYY-MM-DD`。鉴权:除 Onboarding 前的注册/登录外,所有端点要求 Supabase Auth Bearer token(登录端点由 API 组在 v1.1 补充,不影响以上结构)。

## 语义约定

- `GET /v1/energy/:date` 在**未签到**时返回 `data: null`(HTTP 200),App 以此判断是否显示 Check-in 引导;`getTodayPlan` 同理;
- `POST /v1/checkins` 同日重复提交 = 覆盖更新,返回重新计算的 `EnergyResult`;
- `EnergyResult.factors[].impact` 仅存在于 scoring factor(`role: 'reported_energy'`);`possible_context` 因子不带 `impact`,UI 不显示其分数贡献,只展示解释文案;
- `CoachReply.disclaimer` 必须始终返回非空(产品诚信要求,TEAM_CONTRACT §10);
- `MealRecommendation.usesFridgeItemIds` 引用同一响应内 `NutritionPlan.fridge[].id`;
- 错误码:`UNAUTHORIZED`、`VALIDATION_ERROR`、`NOT_FOUND`、`RATE_LIMITED`、`INTERNAL`。

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
| Today's Plan | `DayPlan.blocks[]` + `Task[]` + `CoachReply` + `regeneratePlan` |
| Nutrition | `NutritionPlan`(needs/fridge/meals/rationale) |

## 后端待办(从契约出发)

1. Express 路由骨架 + Zod 验证(shape 直接从 `@akeso/domain` 派生);
2. Supabase 表:`checkin`、`energy_result`、`task`、`plan_block`(+ `fridge_item`、`nutrition_*` 视 P1 而定)以 Migration 提交;
3. `EnergyEngine` / `PlannerService` 纯 TS 实现(Domain 负责人,单测 ≥80%);
4. 用 `packages/domain/src/fixtures.ts` 作为 Demo 种子数据,保证前后端切换前后画面一致。
