import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import mdx from '@astrojs/mdx'
import remarkDirective from 'remark-directive'
import { remarkEditorialBlocks } from './src/plugins/remark-editorial-blocks.mjs'

export default defineConfig({
  site: 'https://alafourca.dev',
  trailingSlash: 'never',
  integrations: [sitemap(), mdx()],
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
