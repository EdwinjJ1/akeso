import { build } from 'esbuild'

// Vercel's @vercel/node builder transpiles each .ts file individually for
// ESM output instead of bundling, which leaves extensionless relative
// imports (and our raw-TS workspace packages @akeso/domain / @akeso/contracts)
// unresolved at runtime (ERR_MODULE_NOT_FOUND). Pre-bundling into a single
// fully-resolved file sidesteps that entirely.
//
// Real npm dependencies (express, @supabase/supabase-js, …) stay external so
// they load from node_modules next to the function. The @akeso/* workspace
// packages must NOT be external — their package.json "main" points at raw
// .ts source, which Node cannot execute at runtime — so we let esbuild inline
// their TypeScript source into the bundle.
const npmDependencies = [
  '@supabase/supabase-js',
  'cors',
  'express',
  'express-rate-limit',
  'multer',
]

await build({
  entryPoints: ['src/vercel-entry.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: npmDependencies,
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
})
