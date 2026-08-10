// The site's own fixed chrome — the brand mark (TypewriterLogo.astro) and the
// navigation pill (Navbar.astro) — measured on a real page, at the widths
// where they compete for the same strip of screen.
//
// The measured defect this file exists to catch: the pill is `fixed left-1/2
// -translate-x-1/2`, which gives it a containing block only 50% of the
// viewport wide. Below ~1210px that box is narrower than the pill's own
// content, so the links wrapped onto a second line inside a 44px pill; and
// between 768px and 1023px the pill's box overlapped the logo by 153px down
// to 25px, with a real pointer click on the brand at 768px landing on
// `<a href="/empieza-aqui">` instead. A tablet, or a window at half a
// desktop screen, could not go home by clicking the brand.
//
// Everything here is measured against the production build every other e2e
// spec runs against (playwright.config.ts's webServer), with real pointer
// input — never a dispatched event.
import { expect, test, type Page } from '@playwright/test'

// The band where the pill and the logo are most likely to collide, plus the
// phone and the two desktop widths that must not regress.
const WIDTHS = [390, 768, 900, 1023, 1280, 1440] as const

const LOGO = 'a[aria-label^="Inicio"]'
const PILL = 'nav[aria-label="Navegación principal"]'

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }

async function rectOf(page: Page, selector: string): Promise<Rect> {
  return page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
  })
}

// Which link or button a real pointer would actually reach at this point.
// Deliberately reported as the anchor's own href (or the button's id) rather
// than as the raw element: what matters to a player is where the click goes,
// not which span happened to be topmost.
async function controlAt(page: Page, x: number, y: number): Promise<string | null> {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      const anchor = el.closest('a')
      if (anchor) return `a[href=${anchor.getAttribute('href')}]`
      const button = el.closest('button')
      if (button) return `button#${button.id}`
      return el.tagName.toLowerCase()
    },
    { x, y },
  )
}

test.describe('Site chrome — the brand mark owns its own click', () => {
  for (const width of WIDTHS) {
    test(`at ${width}px the navigation pill never covers the brand mark`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.locator(PILL)).toBeVisible()

      const logo = await rectOf(page, LOGO)
      const pill = await rectOf(page, PILL)

      const overlapX = Math.min(logo.right, pill.right) - Math.max(logo.left, pill.left)
      const overlapY = Math.min(logo.bottom, pill.bottom) - Math.max(logo.top, pill.top)
      const overlap = overlapX > 0 && overlapY > 0 ? overlapX : 0
      expect(
        overlap,
        `the pill (${Math.round(pill.left)}..${Math.round(pill.right)}) overlaps the brand mark (${Math.round(logo.left)}..${Math.round(logo.right)}) by ${Math.round(overlap)}px`,
      ).toBe(0)
    })

    test(`at ${width}px every point of the brand mark belongs to the brand mark`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.locator(PILL)).toBeVisible()

      const logo = await rectOf(page, LOGO)
      // A grid across the whole rendered mark, not just its centre: at 900px
      // the centre was reachable while the mark's right half was not, so a
      // centre-only probe would have called that width healthy.
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const x = logo.left + logo.width * fx
        const y = logo.top + logo.height / 2
        expect(
          await controlAt(page, x, y),
          `the pointer at (${Math.round(x)}, ${Math.round(y)}) — ${Math.round(fx * 100)}% across the brand mark — reaches the brand mark`,
        ).toBe('a[href=/]')
      }
    })

    test(`at ${width}px a real click on the brand mark goes home`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      // From a page that is NOT home, so "we ended up at /" cannot be a
      // no-op that passes because we never left.
      await page.goto('/blog')
      await expect(page.locator(PILL)).toBeVisible()

      const logo = await rectOf(page, LOGO)
      await page.mouse.click(logo.left + logo.width / 2, logo.top + logo.height / 2)
      await page.waitForURL('**/')
      expect(new URL(page.url()).pathname).toBe('/')
    })

    test(`at ${width}px no two navigation controls overlap and none is unreachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.locator(PILL)).toBeVisible()

      const report = await page.evaluate((pillSelector) => {
        const pill = document.querySelector(pillSelector)!
        const controls = [...pill.querySelectorAll('a, button')].filter(
          (el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
        )
        const name = (el: Element) => (el.textContent?.trim() || (el as HTMLElement).id || el.tagName).slice(0, 16)
        const overlaps: string[] = []
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i].getBoundingClientRect()
            const b = controls[j].getBoundingClientRect()
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            if (ox > 0 && oy > 0) overlaps.push(`${name(controls[i])} × ${name(controls[j])} = ${Math.round(ox)}px`)
          }
        }
        const unreachable: string[] = []
        for (const el of controls) {
          const r = el.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          if (!hit || !el.contains(hit)) unreachable.push(name(el))
        }
        return { count: controls.length, overlaps, unreachable }
      }, PILL)

      expect(report.count, 'the pill renders at least one control').toBeGreaterThan(0)
      expect(report.overlaps, 'no two navigation controls share screen space').toEqual([])
      expect(report.unreachable, 'every navigation control receives its own click').toEqual([])
    })

    test(`at ${width}px no navigation label wraps onto a second line`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.locator(PILL)).toBeVisible()

      // Measured on the text itself via a Range, not on the anchor's height:
      // the anchor also contains the hover-underline span, so its box says
      // nothing about whether the words broke. At 768–1100 "Empieza aquí",
      // "La Forja" and "Sobre mí" each rendered 39px tall inside a 44px
      // pill — two lines — because the pill's own box was clamped to 50% of
      // the viewport and the flex items shrank to fit it.
      const wrapped = await page.evaluate((pillSelector) => {
        const pill = document.querySelector(pillSelector)!
        const broken: string[] = []
        for (const anchor of pill.querySelectorAll('a')) {
          const label = [...anchor.childNodes].find(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
          )
          if (!label) continue
          const range = document.createRange()
          range.selectNodeContents(label)
          const lines = range.getClientRects().length
          if (lines > 1) broken.push(`${label.textContent!.trim()} (${lines} lines)`)
        }
        return broken
      }, PILL)

      expect(wrapped, 'every navigation label renders on one line').toEqual([])
    })
  }

  test('the mobile menu still opens at 390px and its links are reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const menu = page.locator('#mobile-menu')
    await expect(menu).toBeHidden()

    const toggle = page.locator('#menu-toggle')
    const box = (await toggle.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(menu).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // The menu's own entries, reached with a real pointer — the panel sits
    // under the same fixed chrome the pill lives in, so "visible" is not
    // enough to know a finger would land on it.
    const forja = menu.getByRole('link', { name: 'Entrar a La Forja', exact: true })
    const linkBox = (await forja.boundingBox())!
    expect(
      await controlAt(page, linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2),
      'the pointer over a mobile menu link reaches that link',
    ).toBe('a[href=/forja]')

    await page.mouse.click(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2)
    await page.waitForURL('**/forja')
    expect(new URL(page.url()).pathname).toBe('/forja')
  })
})
