// AstroContainer renders Astro components in isolation, but it does not run
// the Content Layer loaders that `astro dev` and `astro build` run. Without
// this adapter, container tests pass on a developer machine only when a stale
// `.astro/data-store.json` happens to exist and see an empty collection in CI.
//
// Production keeps using the real glob loader from content.config.ts. This
// test-only adapter reads the very same Markdown corpus so container-rendered
// pages receive deterministic entries in a completely clean checkout.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { vi } from 'vitest'

const EXERCISES_DIR = fileURLToPath(
  new URL('../../src/content/forja/exercises/', import.meta.url),
)

interface TestContentEntry {
  id: string
  collection: 'forjaExercises'
  data: Record<string, unknown>
  body: string
  filePath: string
}

function loadForjaEntries(): TestContentEntry[] {
  return readdirSync(EXERCISES_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const filePath = join(EXERCISES_DIR, file)
      const { data, content } = matter(readFileSync(filePath, 'utf8'))
      return {
        id: file.replace(/\.md$/, ''),
        collection: 'forjaExercises',
        data,
        body: content,
        filePath,
      }
    })
}

vi.mock('astro:content', async (importOriginal) => {
  const original = await importOriginal<typeof import('astro:content')>()
  return {
    ...original,
    getCollection: async (
      collection: string,
      filter?: (entry: TestContentEntry) => boolean,
    ) => {
      if (collection !== 'forjaExercises') {
        return original.getCollection(collection as never, filter as never)
      }

      const entries = loadForjaEntries()
      return filter ? entries.filter(filter) : entries
    },
  }
})
