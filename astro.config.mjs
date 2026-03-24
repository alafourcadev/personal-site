import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import sitemap from '@astrojs/sitemap'

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://alafourca.dev',
  integrations: [tailwind({ applyBaseStyles: false }), sitemap(), react()],
})