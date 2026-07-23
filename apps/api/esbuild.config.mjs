import { build } from 'esbuild'
import { mkdir, writeFile, rm } from 'node:fs/promises'

// ---------------------------------------------------------------------------
// Build Output API (https://vercel.com/docs/build-output-api/v3)
//
// We do NOT rely on any framework preset or on @vercel/node auto-detecting an
// Express entry from src/. Instead this script emits the complete `.vercel/output`
// tree that Vercel serves verbatim. When `.vercel/output/config.json` exists,
// Vercel ignores framework detection entirely — so it can never fall back to
// per-file transpiling our raw-TS source (the ERR_MODULE_NOT_FOUND cause).
//
// Everything is inlined into ONE self-contained file: the extensionless relative
// imports and the raw-TS workspace packages (@akeso/domain, @akeso/contracts) are
// resolved and bundled by esbuild, and npm deps (express, supabase, …) are inlined
// too — so the deployed function has zero runtime module resolution and needs no
// node_modules beside it.
// ---------------------------------------------------------------------------

const OUTPUT = '.vercel/output'
const FN_DIR = `${OUTPUT}/functions/api.func`

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(FN_DIR, { recursive: true })

await build({
  entryPoints: ['src/vercel-entry.ts'],
  outfile: `${FN_DIR}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Inline EVERYTHING. No `external` — the function is fully self-contained,
  // so the deployed lambda has no runtime module resolution and needs no
  // node_modules beside it.
  banner: {
    js: "import { createRequire as __cr } from 'module'; import { fileURLToPath as __ftp } from 'url'; import { dirname as __dn } from 'path'; const require = __cr(import.meta.url); const __filename = __ftp(import.meta.url); const __dirname = __dn(__filename);",
  },
})

// .vc-config.json: tells Vercel this is a Node.js serverless function and to
// wrap it with the launcher that adapts (req,res) — our Express app is a valid
// Node request listener, so the default Node launcher invokes it directly.
await writeFile(
  `${FN_DIR}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
    },
    null,
    2
  )
)

// package.json inside the func so Node treats the region as ESM.
await writeFile(
  `${FN_DIR}/package.json`,
  JSON.stringify({ type: 'module' }, null, 2)
)

// Top-level output config: route every request to the single `api` function.
await writeFile(
  `${OUTPUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: '/(.*)', dest: '/api' }],
    },
    null,
    2
  )
)

console.log('Build Output API tree written to', OUTPUT)
