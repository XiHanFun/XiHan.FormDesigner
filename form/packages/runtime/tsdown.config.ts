import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts', design: 'src/design.ts', locale: 'src/locale/index.ts' },
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  clean: true,
  treeshake: true,
  deps: {
    neverBundle: [/^@xihan-form\//, /^@xihan-ui\//],
  },
  checks: {
    pluginTimings: false,
  },
})
