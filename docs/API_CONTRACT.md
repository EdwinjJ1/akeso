# Akeso API Contract (v1)

对应 Issue #6。**冻结规则**:本文件与 `packages/domain/src/types.ts`、`packages/domain/src/service.ts` 共同构成共享契约。修改任何字段都需要全部模块负责人同意(TEAM_CONTRACT §2)。

## 原则

- App 只通过 `AkesoService` 接口(`packages/domain/src/service.ts`)取数据,接口方法与 HTTP 端点 1:1 对应;
- `FixtureService`(现在)和 `ApiService`(集成后)必须返回**完全相同的结构**,页面在切换时零改动;
- 所有响应使用统一 envelope;所有类型定义以 `@akeso/domain` 为唯一权威,后端不得另行定义;
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
- `EnergyResult.factors[].impact` 为带符号整数,UI 直接渲染 `+/-`;
- `CoachReply.disclaimer` 必须始终返回非空(产品诚信要求,TEAM_CONTRACT §10);
- `MealRecommendation.usesFridgeItemIds` 引用同一响应内 `NutritionPlan.fridge[].id`;
- 错误码:`UNAUTHORIZED`、`VALIDATION_ERROR`、`NOT_FOUND`、`RATE_LIMITED`、`INTERNAL`。

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
