# Vercel 环境变量对照清单

手动核对/同步用。密钥值不写在这里 —— 标注了每个值的本地来源文件。
当前状态:除 `EXPO_PUBLIC_API_URL` 外,下列变量已全部在 Vercel 配好(2026-07-23 验证)。

## 项目 1:`akeso`(网页端,Expo web 静态导出)

Dashboard: https://vercel.com/jiaedwin0605-gmailcoms-projects/akeso/settings/environment-variables

| 变量 | 值 / 来源 | 环境 | 状态 |
|------|-----------|------|------|
| `EXPO_PUBLIC_API_URL` | `akeso-api` 的生产域名(合并 PR #63 后产生,形如 `https://akeso-api-xxx.vercel.app`)。**不能是 localhost** | Production + Preview | ⏳ 待 API 上生产后填 |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nergkjhwzecpcfejkouv.supabase.co` | Production + Preview | ✅ 已配 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/app/.env` 里的 `sb_publishable_…` 值(公开安全,不是 service role) | Production + Preview | ✅ 已配 |

注意:`EXPO_PUBLIC_*` 是**构建期**内联进前端 bundle 的。改了变量后必须**重新部署**网页项目才生效。

## 项目 2:`akeso-api`(Express API,Vercel Function)

Dashboard: https://vercel.com/jiaedwin0605-gmailcoms-projects/akeso-api/settings/environment-variables

| 变量 | 值 / 来源 | 环境 | 状态 |
|------|-----------|------|------|
| `SUPABASE_URL` | `https://nergkjhwzecpcfejkouv.supabase.co` | Prod + Preview + Dev | ✅ 已配 |
| `SUPABASE_SERVICE_ROLE_KEY` | `apps/api/.env`(服务端密钥,**永不**进网页项目 / EXPO_PUBLIC_*) | Prod + Preview + Dev | ✅ 已配 |
| `GEMINI_API_KEY` | `apps/api/.env`(2026-07-23 已轮换的新 key,已验证可用) | Prod + Preview + Dev | ✅ 已配 |
| `VISION_PROVIDER` | `gemini` | Prod + Preview + Dev | ✅ 已配 |
| `CORS_ORIGINS` | `https://akeso-navy.vercel.app,http://localhost:8081,http://localhost:19006` | Prod + Preview + Dev | ✅ 已配 |

可选(有代码默认值,未配):`RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `RATE_LIMIT_WRITE_MAX` / `VISION_FEATURE_ENABLED` / `MIMO_API_KEY`(仅当 VISION_PROVIDER=mimo)。

## 项目设置(非环境变量,已配好)

`akeso-api`:Root Directory = `apps/api`(含 Include files outside root)、Framework = Other、SSO Deployment Protection = 关闭(API 靠 Supabase Auth 保护 /v1)。

## 上线后冒烟测试清单

1. `curl https://<api生产域名>/health` → 200 `{"status":"ok"}`
2. `curl https://<api生产域名>/v1/profile` → 401(无 token 被拒,说明鉴权在)
3. 打开 https://akeso-navy.vercel.app → 首页正常渲染,无 "Could not load your profile"
4. 匿名开始 → 完成签到 → Energy Score 出现(验证 Supabase Auth + 受保护 API 全链路)
5. More → Health Reports → 上传报告图片 → 解析出指标(验证 Gemini key + health_report 表)
