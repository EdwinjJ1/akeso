# Release guide

## Web: Vercel

The root `vercel.json` exports the Expo Router web app to `apps/app/dist`.

1. Import `EdwinjJ1/akeso` in Vercel, keeping the repository root as the Root Directory.
2. Add these Vercel Production Environment Variables only when switching the app from its built-in fixture demo to the live API:
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. The build command is `npm run app:export` and static output is `apps/app/dist`.

The current app uses its fixture service unless `EXPO_PUBLIC_API_URL` is set. Do not set it to `http://localhost:3001` for a public deployment: a device or browser cannot reach the developer's local machine.

### Account persistence checklist

Cross-device account sync is enabled only when the app is connected to the production API and Supabase. Before releasing it:

1. Run every migration in `apps/api/supabase/migrations` and deploy `apps/api` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` kept server-side.
2. In Supabase Auth, enable email auth, anonymous sign-ins, and manual identity linking.
3. Change the email sign-in and email-change templates to show the six-digit `{{ .Token }}` value. The app intentionally uses an entered OTP instead of a deep link so the same flow works on web, iOS, and Android.
4. Add the deployed web and app redirect URLs to Supabase's URL configuration.
5. Enable CAPTCHA or Cloudflare Turnstile for anonymous sign-ins and keep the existing API rate limits enabled before exposing the deployment publicly.

The fixture demo persists onboarding profile data only in the current browser/device. It does not provide cross-device account recovery.

## Installable builds: EAS

`apps/app/eas.json` supplies two profiles:

- `preview`: an internally distributable APK on Android and ad hoc IPA on iOS.
- `production`: a store-ready Android App Bundle and iOS archive.

The permanent iOS Bundle ID and Android package are both `com.edwinjj1.akeso`. They must remain globally unique and owned by the release account; change them before the first store submission if that identity is not correct.

From `apps/app`:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

Android's preview output is an APK that can be downloaded and installed directly after accepting the device's unknown-source prompt. iOS has no equivalent risk-bypass: an IPA must be signed. For direct testing, the device UDID must be registered through `eas device:create` before the build; EAS then produces an ad hoc IPA. For general public iOS distribution, use TestFlight/App Store. Enterprise distribution is only for eligible organizations and is not a consumer-install workaround.

EAS can generate and manage the Android keystore, iOS distribution certificate, and provisioning profile after the release account signs in.
