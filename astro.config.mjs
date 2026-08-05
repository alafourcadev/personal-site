import { defineConfig, envField } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import remarkDirective from 'remark-directive'
import { remarkEditorialBlocks } from './src/plugins/remark-editorial-blocks.mjs'

export default defineConfig({
  site: 'https://alafourca.dev',
  trailingSlash: 'never',
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
    remarkPlugins: [remarkDirective, remarkEditorialBlocks],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
})
