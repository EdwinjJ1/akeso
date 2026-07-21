const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

/**
 * expo-router's require.context scans every file under src/app as a
 * candidate route (see node_modules/expo-router/_ctx.web.js) — it only
 * special-cases `+api`/`+middleware`/`+html`/`+native-intent` names, not
 * colocated tests. checkin.logic.test.ts lives there, and vitest's
 * test()/expect() globals throw synchronously when the module is imported
 * outside the vitest runner, which crashes web's static-render route-tree
 * validation before it ever gets to "no default export, skip this file".
 * Native never hits this because unused routes are only required lazily on
 * navigation; only the web build eagerly imports every matched route.
 *
 * The default blockList already excludes `__tests__/` directories for this
 * exact reason — this just extends the same exclusion to `*.test.ts(x)`
 * files colocated directly under src/app.
 */
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]),
  /\/src\/app\/.*\.test\.[jt]sx?$/,
]

/**
 * packages/contracts and packages/domain are TypeScript-only workspace
 * packages (`main`/`types` point straight at `src/index.ts` — no build
 * step) that import sibling modules using TS's NodeNext convention, e.g.
 * `import { localDateSchema } from './schemas.js'` from inside a `.ts` file.
 * `tsc`'s `moduleResolution: "bundler"` (and Vite/Vitest, which is why the
 * test suite never caught this) resolve that `.js` specifier straight to
 * the sibling `./schemas.ts` file. Metro's resolver doesn't do that
 * remapping on its own, so it 404s looking for a literal `schemas.js` that
 * doesn't exist.
 *
 * This retries any relative import Metro couldn't resolve by swapping a
 * trailing `.js`/`.jsx` for `.ts`/`.tsx` before giving up — scoped to
 * relative specifiers only so it can't mask an unrelated missing-package
 * error under a confusing "no such .ts file" one.
 */
const { resolveRequest: defaultResolveRequest } = config.resolver
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest
  try {
    return resolve(context, moduleName, platform)
  } catch (error) {
    const isRelative = moduleName.startsWith('./') || moduleName.startsWith('../')
    if (isRelative && moduleName.endsWith('.js')) {
      return resolve(context, `${moduleName.slice(0, -3)}.ts`, platform)
    }
    if (isRelative && moduleName.endsWith('.jsx')) {
      return resolve(context, `${moduleName.slice(0, -4)}.tsx`, platform)
    }
    throw error
  }
}

module.exports = config
