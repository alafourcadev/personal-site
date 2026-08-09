// Unit-level companion to time-of-day.test.ts: that one is the gate over the
// real 169 exercises, this one pins the rule the plugin implements, including
// the case it must NOT touch — the editorial blocks the blog depends on.
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import remarkDirective from 'remark-directive'
import { beforeAll, describe, expect, it } from 'vitest'
// Both plugins are plain .mjs, imported exactly as astro.config.mjs imports them.
import { remarkEditorialBlocks } from '../../src/plugins/remark-editorial-blocks.mjs'
import { remarkClockTimes } from '../../src/plugins/remark-clock-times.mjs'

let render: (source: string) => Promise<string>

beforeAll(async () => {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkDirective, remarkClockTimes, remarkEditorialBlocks],
  })
  render = async (source: string) => (await processor.render(source)).code
})

describe('remarkClockTimes', () => {
  it('keeps the minutes of a time of day', async () => {
    expect(await render('El corte es a las 23:56.')).toContain('23:56')
  })

  it('keeps the paragraph in one piece — no empty <div> where the minutes were', async () => {
    const html = await render('Marcela, que a las 18:40 exporta la planilla, se fue de licencia.')
    expect(html).not.toContain('<div></div>')
    expect(html).toContain('a las 18:40 exporta')
  })

  it('survives emphasis around the time, which the mis-parse used to tear apart', async () => {
    const html = await render('_Que el informe salga a las 23:57 o a las 4 de la mañana no me importa._')
    expect(html).toContain('23:57')
    expect(html).toMatch(/<em>[^<]*23:57[^<]*<\/em>/)
  })

  it('leaves the editorial container directives the blog is built on untouched', async () => {
    const html = await render(':::regla-senior\nUn paso manual no es un detalle.\n:::')
    expect(html).toContain('data-label="Regla senior"')
    expect(html).toContain('ed-regla-senior')
  })

  it('leaves a genuine named text directive alone', async () => {
    const html = await render('Texto con :nota[algo] adentro.')
    expect(html).not.toContain(':nota[algo]')
  })
})
