import { describe, expect, it } from 'vitest'
import {
  learningConceptProfiles,
  sharedLearningConcepts,
} from '../../src/lib/forja/progression/learning-concepts'

describe('curriculum learning concepts', () => {
  it('makes same-level transfer compatibility explicit and machine-checkable', () => {
    const profiles = learningConceptProfiles([
      { id: 'n4-source', level: 4 },
      { id: 'n4-target', level: 4 },
      { id: 'n5-unrelated', level: 5 },
    ])

    expect(sharedLearningConcepts('n4-source', 'n4-target', profiles)).toEqual([
      'comunicacion-entre-servicios',
    ])
    expect(sharedLearningConcepts('n4-source', 'n5-unrelated', profiles)).toEqual([])
  })

  it('does not invent a concept for content outside the declared curriculum', () => {
    expect(learningConceptProfiles([{ id: 'future', level: 13 }])).toEqual([])
  })
})
