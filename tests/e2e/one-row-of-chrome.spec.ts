// The shell promises one row of chrome above the workbench, and shipped two.
//
// forja-shell.ts declares FORJA_TOP_BAR_HEIGHT_PX = 72 and says in as many
// words that "every pixel of chrome is a pixel the canvas does not get, which
// is why it is one row". Underneath it the playground drew its own view bar
// with the same `bg-bg-surface` and the same `border-b border-border-subtle`:
// the same plane and the same line, about 96px reading as one slab of chrome
// with an arbitrary rule through the middle of it.
//
// So the view bar stops being a bar. It keeps its tabs and gives up its
// surface and its line: it belongs to the workspace under it, not to the
// chrome over it. Only inside the shell. Free play is a boxed playground on an
// ordinary page, where that row is its entire toolbar and its own border is
// what tells it apart from the article around it.
//
// The second half is the tab that was lying. At every width the shell can
// reach, opening the verdict opens a rail BESIDE the canvas, so "Lienzo" and
// "Resultado" were offered as alternatives while both were painted at once.
// A rail has no tab, which is the rule the library rail has always followed.
import { expect, test, type Page } from '@playwright/test'
import { createNode, waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

async function openExercise(page: Page) {
  await page.goto(EXERCISE)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// The rendered paint of a row, not the class it was written with: a class read
// from source cannot prove which declaration actually won.
async function paintOf(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      background: style.backgroundColor,
      borderBottom: style.borderBottomWidth,
      height: Math.round(el.getBoundingClientRect().height),
    }
  })
}

test.describe('La Forja: the shell spends one row of chrome, not two', () => {
  test('the view bar gives up the surface and the line the top bar owns', async ({ page }) => {
    await openExercise(page)

    const bar = await paintOf(page, 'forja-topbar')
    const views = await paintOf(page, 'playground-view-bar')

    expect(bar.height, 'the one row the shell declares').toBe(72)
    expect(views.background, 'the view bar paints no surface of its own').toBe('rgba(0, 0, 0, 0)')
    expect(views.borderBottom, 'and draws no second divider under it').toBe('0px')
    expect(views.background).not.toBe(bar.background)
  })

  test('free play keeps its own toolbar, because there it is the whole chrome', async ({ page }) => {
    await page.goto('/forja/lienzo')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()

    const views = await paintOf(page, 'playground-view-bar')
    expect(views.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(views.borderBottom).not.toBe('0px')
  })

  test('the header uses one operating face and spells the blog exit as one phrase', async ({ page }) => {
    await openExercise(page)

    const report = await page.evaluate(() => {
      const ids = [
        'forja-mark-name',
        'forja-position',
        'forja-exercise-name',
        'submit-button',
        'undo-button',
        'reset-exercise-button',
        'forja-menu-toggle',
        'forja-back-to-blog',
      ]
      const families = ids.map((id) =>
        getComputedStyle(document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!).fontFamily,
      )
      const link = document.querySelector<HTMLElement>('[data-testid="forja-back-to-blog"]')!
      const visible = Array.from(link.children)
        .filter((child) => getComputedStyle(child).display !== 'none')
        .map((child) => child.getBoundingClientRect())
      return {
        families: [...new Set(families)],
        exitGap: visible.length > 1 ? Math.round(visible[1].left - visible[0].right) : 0,
      }
    })

    expect(report.families).toEqual(['Inter, sans-serif'])
    expect(report.exitGap, 'the arrow and the phrase do not run together').toBeGreaterThanOrEqual(8)
    await expect(page.getByTestId('forja-back-to-blog')).toHaveAccessibleName('Volver al blog')
    await expect(page.getByText('Volver al blog', { exact: true })).toBeVisible()
  })

  for (const width of [768, 1024, 1280]) {
    test(`the roomier header still keeps every group reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await openExercise(page)

      const report = await page.getByTestId('forja-topbar').evaluate((bar) => {
        const outer = bar.getBoundingClientRect()
        const groups = Array.from(bar.children).map((element, index) => {
          const box = element.getBoundingClientRect()
          return {
            name: element.getAttribute('data-testid') ?? `group-${index + 1}`,
            left: box.left,
            right: box.right,
            top: box.top,
            bottom: box.bottom,
          }
        })
        const unreachable = groups
          .filter(
            (group) =>
              group.left < outer.left - 0.5 ||
              group.right > outer.right + 0.5 ||
              group.top < outer.top - 0.5 ||
              group.bottom > outer.bottom + 0.5,
          )
          .map((group) => group.name)
        const overlaps: string[] = []
        for (let left = 0; left < groups.length; left += 1) {
          for (let right = left + 1; right < groups.length; right += 1) {
            const x = Math.min(groups[left].right, groups[right].right) - Math.max(groups[left].left, groups[right].left)
            const y = Math.min(groups[left].bottom, groups[right].bottom) - Math.max(groups[left].top, groups[right].top)
            if (x > 0.5 && y > 0.5) overlaps.push(`${groups[left].name} × ${groups[right].name}`)
          }
        }
        const exercise = bar.querySelector('[data-testid="forja-exercise-name"]')!.getBoundingClientRect()
        return { unreachable, overlaps, exerciseWidth: Math.round(exercise.width) }
      })

      expect(report.unreachable, 'every header group remains inside the bar').toEqual([])
      expect(report.overlaps, 'header groups keep their own space').toEqual([])
      expect(report.exerciseWidth, 'the current exercise keeps a readable foothold').toBeGreaterThanOrEqual(80)
    })
  }

  test('the verdict rail has no tab, and the canvas tab tells the truth while it is up', async ({ page }) => {
    await openExercise(page)
    await expect(page.getByTestId('view-result-tab')).toBeVisible()

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    // Both are on screen at once, which is exactly why one of them must not be
    // offered as an alternative to the other.
    await expect(page.locator('.react-flow')).toBeVisible()
    await expect(page.getByTestId('view-result-tab')).toHaveCount(0)
    await expect(
      page.locator('[role="tab"]', { hasText: 'Lienzo' }),
      'the canvas is what the workspace shows, so its tab is the selected one',
    ).toHaveAttribute('aria-selected', 'true')
  })

  test('closing the verdict brings the tab back, so nothing is stranded', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    await page.getByTestId('close-result-panel').click()
    await expect(page.getByTestId('result-panel')).toHaveCount(0)

    const tab = page.getByTestId('view-result-tab')
    await expect(tab).toBeVisible()
    await tab.click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
  })

  test('free play keeps the Resultado tab, where the verdict is still a view of its own row', async ({ page }) => {
    await page.goto('/forja/lienzo')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('view-result-tab')).toHaveAttribute('aria-selected', 'true')
  })
})
