import { defineConfig, envField } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import remarkDirective from 'remark-directive'
import { remarkClockTimes } from './src/plugins/remark-clock-times.mjs'
import { remarkEditorialBlocks } from './src/plugins/remark-editorial-blocks.mjs'

export default defineConfig({
  site: 'https://alafourca.dev',
  trailingSlash: 'never',
  // The toolbar must not appear in product captures or visual review sessions.
  devToolbar: { enabled: false },
  // /forja is unlinked and deliberately excluded from the sitemap while it
  // is in active development (design D5 — containment, revertible on its own).
  integrations: [sitemap({ filter: (page) => !page.includes('/forja') }), mdx(), react()],
  // Supabase credentials for R3's ranking adapter — optional so R1 builds and
  // plays with zero credentials (design D7, astro:env not import.meta.env).
  env: {
    schema: {
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_FORJA_ENABLED: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
  markdown: {
    // `remarkClockTimes` runs right after the directive parser and undoes its
    // only false positive: `:56` in "las 23:56" is not a directive, it is the
    // minutes of a time of day (see src/plugins/remark-clock-times.mjs).
    remarkPlugins: [remarkDirective, remarkClockTimes, remarkEditorialBlocks],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
})
