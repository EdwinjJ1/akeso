# Akeso Demo Video Script

## Objective

Produce a 3–5 minute Devpost demo video that positions Akeso as a personal energy coach for students. The video must make the problem feel personal, demonstrate a complete working flow, show a visible change caused by a different daily state, and support the time-saving claim with an honest before-and-after measurement.

## Recording Setup

- Target runtime: 4:05–4:20.
- Narration: English.
- Screen direction and editing notes: included below in Chinese.
- Primary device: mobile portrait capture, placed inside a clean phone frame.
- Record the app interactions first, then record narration against the final edit.
- The sample timing claim is `12:00` versus `0:25`; use it only if the team's timed trials support it, otherwise replace all derived values consistently.
- Use fictional student data only.

## Story

Alex is a UNSW student with several tasks but limited energy. The old workflow requires checking a calendar, sorting a task list, judging personal energy, and deciding what to eat. Akeso replaces that fragmented planning process with a short daily check-in, an explainable energy map, an energy-aware schedule, and practical food suggestions. The decisive moment is a second check-in with lower energy: Akeso changes the plan instead of giving the same generic schedule.

## Shot-by-Shot Script

### 0:00–0:18 — Cold open

**画面**

- 快切三个画面：课程日历、混乱的待办清单、打开的冰箱或外卖页面。
- 屏幕中央出现问题：`What should I do first — and when?`
- 右上角计时器从 `00:00` 开始运行。

**旁白**

> This is Alex, a UNSW student with an assignment, a tutorial, emails, laundry, and no idea which version of the plan today’s energy can actually handle.

### 0:18–0:42 — Original workflow

**画面**

- 分屏或加速展示：查看 Calendar、手动拖动任务、反复调整优先级、思考午饭。
- 计时器快进到团队实测的基线时间；以下示例使用 `12:00`。
- 定格字幕：`Manual planning: 12:00`。

**旁白**

> The usual workflow is fragmented. Alex checks a calendar, ranks every task, guesses when concentration will be best, moves things around, and then decides what to eat. In our timed comparison, that took twelve minutes. And tomorrow, the whole decision starts again.

### 0:42–0:55 — Product reveal

**画面**

- Akeso Welcome 页快速出现。
- Logo 与标语放大：`Less grind. Better timing.`
- 切到 Today 首页的签到入口。

**旁白**

> We built Akeso: a personal energy coach that plans around the day you actually have, not the perfect day you imagined.

### 0:55–1:25 — Daily check-in

**画面**

- 点击 `Daily check-in`。
- 以自然但快速的速度完成能量、睡眠、上次进食和饮水问题。
- 选择一个容易展示的状态，例如：`Good energy`、`7–8h sleep`、`1–3h since food`、`0.5–1L water`。
- 可选文本填入：`leftover salmon rice bowl`。
- 进度条从 `0 / 4` 到 `4 / 4`，点击 `Get my energy plan`。
- 计时器停在团队实测的 Akeso 时间；以下示例使用 `00:25`。

**旁白**

> Instead, Alex gives Akeso four quick signals: current energy, sleep, recent food, and hydration. It takes about twenty seconds, and every answer can be updated as the day changes.

### 1:25–1:58 — Explainable energy result

**画面**

- Energy Score 数字进入时做轻微放大动画。
- 高亮 `Peak` 和 `Reset` 时间标签。
- 手指沿能量曲线移动，随后向下滚动到 `Why this score`。
- 用描边依次强调 reported energy 与 possible context，不要停太久。

**旁白**

> Akeso turns those signals into an energy map. Alex can see the best focus window, the likely afternoon reset, and why the result looks this way. The score is deterministic and explainable. AI can help communicate the plan, but it never invents the authoritative energy score.

### 1:58–2:40 — Energy-aware day plan

**画面**

- 点击底部 `Plan`。
- 从顶部向下滚动时间线。
- 依次高亮：高难任务、午饭、低强度任务、恢复时段。
- 加两条短动画连线：
  - `High-demand assignment → Peak window`
  - `Admin + recovery → Dip window`
- 点击一个计划块，短暂展示可调整标题、时间或完成状态，再保存。

**旁白**

> The planner then matches task demand to energy supply. Alex’s hardest assignment is protected inside the peak. Administrative work moves into the dip. Meals and recovery are not leftovers squeezed between tasks; they become part of the plan. Alex still stays in control and can adjust any suggestion.

### 2:40–3:15 — Wow moment: the plan adapts

**画面**

- 回到 Today，点击 `Update check-in`。
- 其余答案保持不变，只把能量改为 `Low` 或 `Drained`。
- 点击更新，使用前后并排对比：
  - 分数下降；
  - 曲线和文字改变；
  - 日程从重负荷变成保护恢复，只保留一个关键任务。
- 屏幕文字：`Same student. Same tasks. Different day.`

**旁白**

> But personalization only matters if the plan changes. Suppose Alex crashes after lunch. With one updated answer, Akeso recalculates the day. The same student and the same task list now produce a lighter plan: one achievable priority is protected, demanding work is reduced, and recovery gets real space. This is not another static to-do list.

### 3:15–3:38 — Nutrition from what is available

**画面**

- 点击 `Nutrition`。
- 在 `From my fridge` 与 `For my needs` 之间切换。
- 高亮一份 5–10 分钟餐食建议，以及它使用的现有食材。
- 最多展示两份餐食，不要完整滚完页面。

**旁白**

> Akeso also removes the next small decision. It matches today’s needs with food already in Alex’s fridge, then recommends quick meals timed around the energy curve. That means less planning, less waste, and no generic meal list.

### 3:38–3:56 — Technical credibility

**画面**

- 用简洁的一屏架构图，避免展示滚动代码。
- 图示：`Expo app → Express API → Supabase`，旁边放 `TypeScript Energy Engine + Planner` 与 `Validated AI Coach`。
- 底部小字：`Deterministic scoring · Structured validation · Tested domain logic`。

**旁白**

> Under the hood, Akeso uses an Expo app, an Express API, Supabase persistence, deterministic TypeScript scoring and planning, and validated AI coaching. The same inputs produce a consistent score, while the plan remains responsive to the user.

### 3:56–4:18 — Time saved and close

**画面**

- Before/after 大字对比：
  - `Before: 12:00`
  - `With Akeso: 0:25`
  - `Saved: 11:35 per day`
- 下一行动画：`≈ 58 minutes across five weekdays`。
- 最后一屏显示 Akeso Logo、标语与产品界面拼图。

**旁白**

> In our measured workflow, daily planning fell from twelve minutes to twenty-five seconds, saving eleven minutes and thirty-five seconds each day — about fifty-eight minutes across five weekdays. Akeso does not ask students to push harder. It helps them use the energy they already have, at the right time. Akeso: less grind, better timing.

## Timing Evidence

Before exporting, run at least three trials of each workflow and display the median or average with the method named on screen.

### Manual workflow start and stop

- Start: the user receives the same calendar events, task list, and food inventory used in Akeso.
- Stop: the user has produced a time-blocked plan, selected a priority for the peak period, protected a recovery period, and chosen one suitable meal.

### Akeso workflow start and stop

- Start: the user opens the daily check-in with the same inputs available.
- Stop: the generated plan and first meal recommendation are visible.

If the measured example is `12:00` versus `0:25`, the honest derived claims are `11:35 saved per day` and approximately `58 minutes across five weekdays`.

## Editing Rules

- Keep every individual screen segment under eight seconds unless the user is actively completing the check-in.
- Use captions throughout; judges may watch without sound.
- Use zoom and highlight effects to direct attention, not decorative transitions.
- Do not show onboarding in full.
- Do not claim medical accuracy or diagnosis.
- Do not call fixture or pre-seeded data live AI output.
- Do not show ingredient photo recognition unless it is integrated and reliable in the submitted build.
- End no later than 4:20 to leave margin below the five-minute limit.

## Recording Checklist

- Use one fictional persona and the same task list throughout.
- Preload tasks with visibly different energy demands.
- Choose initial check-in values that create a clear peak and dip.
- Rehearse the second check-in so the changed plan is visibly different.
- Record clean app footage without notifications or cursor wandering.
- Replace the sample timing claim everywhere if measured values differ.
- Verify captions, audio level, repository link, and final runtime before upload.
