// forja-exercise-content admission gates (EC1-EC7 + design D9). Each test
// mutates exactly one field of a known-valid fixture — "an ejercicio que no
// se puede evaluar no debe compilar" is the whole point, so every rejection
// case here is a real superRefine issue, not a shape/type error.
import { describe, expect, it } from 'vitest'
import { exerciseSchema } from '../../src/lib/forja/content/exercise-schema'

// A minimal but fully admissible level-4 calibration exercise: mobile client
// routed through the gateway to the service, never directly — teaches the
// mechanic (port compatibility, the gateway's role), evaluates no judgment
// call. Two structurally distinct legal designs, both satisfying both
// guarantees exactly (raw=1, budget untouched, pen=1) so both score 100.
function validExercise(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Primeros pasos: el cliente nunca habla directo con el servicio',
    level: 4,
    role: 'calibration',
    domain: 'onboarding',
    D1: 1,
    D2: 0,
    D3: 2,
    D4: 0,
    D5: 2,
    D6: 0,
    D7: 1,
    D8: 0,
    D9: 2,
    prerequisiteLevels: [3],
    hiddenFacts: [{ fact: 'El gateway es el único punto autorizado para clientes.', discoveryPath: 'El motor rechaza cualquier conexión directa cliente-servicio con un porqué explícito.' }],
    budget: { opsUnits: 6 },
    aiBudget: 'libre',
    lambda: 0.5,
    constraints: [{ metric: 'componentes mínimos', operator: '>=', value: 3, unit: 'componentes' }],
    startingDesign: {
      nodes: [{ id: 'mc0', type: 'mobile-client', label: 'Cliente móvil', zone: 'public', props: {}, given: true }],
      edges: [],
    },
    guarantees: [
      {
        id: 'g-no-direct',
        label: 'El cliente nunca llama directo al servicio',
        weight: 1,
        predicate: { op: 'edgeAbsent', from: { type: ['mobile-client'] }, to: { type: ['service'] } },
        whyMissing: 'Hay una conexión directa entre el cliente y el servicio.',
        consequence: 'El servicio queda expuesto a una red que no controlás.',
      },
      {
        id: 'g-through-gateway',
        label: 'El cliente llega al servicio a través del gateway',
        weight: 1,
        predicate: { op: 'path', from: { type: ['mobile-client'] }, to: { type: ['service'] }, via: { type: ['api-gateway'] } },
        whyMissing: 'No hay un camino desde el cliente hasta el servicio que pase por el gateway.',
        consequence: 'Sin gateway no hay autenticación ni límite de tasa antes del servicio.',
      },
    ],
    rubric: [{ dimension: 'Usa la puerta de entrada', signal: { kind: 'predicate', guaranteeId: 'g-through-gateway' } }],
    referenceSolutions: [
      {
        label: 'Un cliente móvil',
        contextInversion: 'Un único cliente, sin variantes — no hay contexto que invierta la elección aquí.',
        design: {
          nodes: [
            { id: 'mc', type: 'mobile-client', label: 'Cliente móvil', zone: 'public', props: {} },
            { id: 'gw', type: 'api-gateway', label: 'Puerta de entrada', zone: 'dmz', props: {} },
            { id: 'svc', type: 'service', label: 'Servicio', zone: 'private', props: {} },
          ],
          edges: [
            { id: 'mc-gw', from: { node: 'mc' }, to: { node: 'gw' } },
            { id: 'gw-svc', from: { node: 'gw' }, to: { node: 'svc' } },
          ],
        },
      },
      {
        label: 'Cliente móvil y cliente web, ambos por el gateway',
        contextInversion: 'Dos clientes en vez de uno — la topología cambia, la regla no.',
        design: {
          nodes: [
            { id: 'mc', type: 'mobile-client', label: 'Cliente móvil', zone: 'public', props: {} },
            { id: 'wc', type: 'web-client', label: 'Cliente web', zone: 'public', props: {} },
            { id: 'gw', type: 'api-gateway', label: 'Puerta de entrada', zone: 'dmz', props: {} },
            { id: 'svc', type: 'service', label: 'Servicio', zone: 'private', props: {} },
          ],
          edges: [
            { id: 'mc-gw', from: { node: 'mc' }, to: { node: 'gw' } },
            { id: 'wc-gw', from: { node: 'wc' }, to: { node: 'gw' } },
            { id: 'gw-svc', from: { node: 'gw' }, to: { node: 'svc' } },
          ],
        },
      },
    ],
    status: 'PILOT',
    ...overrides,
  }
}

describe('forja-exercise-content — admission gates', () => {
  it('a fully admissible exercise passes', () => {
    const result = exerciseSchema.safeParse(validExercise())
    expect(result.success).toBe(true)
  })

  it('exercise missing a required axis fails validation [EC1]', () => {
    const { D3: _drop, ...rest } = validExercise()
    const result = exerciseSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('index out of band is rejected [EC2]', () => {
    // Level 4 band is [8,16]; pushing every axis to its level-4 ceiling
    // overshoots it (sum 20).
    const result = exerciseSchema.safeParse(
      validExercise({ D1: 2, D2: 2, D3: 3, D4: 2, D5: 2, D6: 2, D7: 3, D8: 2, D9: 2 }),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(JSON.stringify(result.error.issues)).toMatch(/fuera de banda/)
  })

  it('axis over its level ceiling is rejected [EC3]', () => {
    // D1's ceiling at level 4 is 2 (tier3 starts at level 5).
    const result = exerciseSchema.safeParse(validExercise({ D1: 3, D3: 1 }))
    expect(result.success).toBe(false)
    if (!result.success) expect(JSON.stringify(result.error.issues)).toMatch(/excede el techo/)
  })

  it('forward-referencing prerequisite is rejected [EC4]', () => {
    const result = exerciseSchema.safeParse(validExercise({ prerequisiteLevels: [5] }))
    expect(result.success).toBe(false)
  })

  it('single-reference-solution exercise fails validation [EC5]', () => {
    const base = validExercise()
    const result = exerciseSchema.safeParse({ ...base, referenceSolutions: base.referenceSolutions.slice(0, 1) })
    expect(result.success).toBe(false)
  })

  it('an illegal reference solution is rejected by the real engine [D9 build-failing gate]', () => {
    const base = validExercise()
    const illegalSolution = {
      label: 'Cliente directo al servicio',
      contextInversion: 'n/a',
      design: {
        nodes: [
          { id: 'mc', type: 'mobile-client', label: 'Cliente móvil', zone: 'public', props: {} },
          { id: 'svc', type: 'service', label: 'Servicio', zone: 'private', props: {} },
        ],
        edges: [{ id: 'mc-svc', from: { node: 'mc' }, to: { node: 'svc' } }],
      },
    }
    const result = exerciseSchema.safeParse({
      ...base,
      referenceSolutions: [base.referenceSolutions[0], illegalSolution],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(JSON.stringify(result.error.issues)).toMatch(/es ilegal/)
  })

  it('a reference solution over the declared budget is rejected [D9 build-failing gate]', () => {
    const base = validExercise({ budget: { opsUnits: 1 } })
    const result = exerciseSchema.safeParse(base)
    expect(result.success).toBe(false)
    if (!result.success) expect(JSON.stringify(result.error.issues)).toMatch(/excede el presupuesto/)
  })

  it('a rubric dimension without a linked predicate or metric is rejected [EC7]', () => {
    const result = exerciseSchema.safeParse(
      validExercise({ rubric: [{ dimension: 'Algo', signal: { kind: 'predicate', guaranteeId: 'no-existe' } }] }),
    )
    expect(result.success).toBe(false)
  })

  it('D9=0 is inadmissible', () => {
    // D2 raised to compensate so the index stays inside the level-4 band —
    // isolates the D9 gate from EC2's band gate, which would otherwise
    // reject the same fixture for an unrelated reason.
    const result = exerciseSchema.safeParse(validExercise({ D9: 0, D2: 2 }))
    expect(result.success).toBe(false)
    if (!result.success) expect(JSON.stringify(result.error.issues)).toMatch(/D9/)
  })

  it('a tradeoff-role exercise without a pair id is rejected', () => {
    const result = exerciseSchema.safeParse(validExercise({ role: 'tradeoff' }))
    expect(result.success).toBe(false)
  })

  it('a DRAFT exercise is a valid entry — filtering it from play is a route concern, not a schema rejection [EC6]', () => {
    const result = exerciseSchema.safeParse(validExercise({ status: 'DRAFT' }))
    expect(result.success).toBe(true)
  })

  it('an exercise with no startingDesign fails validation [R1-H]', () => {
    const { startingDesign: _drop, ...rest } = validExercise()
    const result = exerciseSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('a startingDesign with zero nodes fails validation — an exercise cannot ship an empty canvas [R1-H]', () => {
    const result = exerciseSchema.safeParse(validExercise({ startingDesign: { nodes: [], edges: [] } }))
    expect(result.success).toBe(false)
  })

  it('a guarantee anchored on a role no starting-design node carries fails the build, naming the role [R1-H]', () => {
    const result = exerciseSchema.safeParse(
      validExercise({
        guarantees: [
          {
            id: 'g-no-volatile-cut',
            label: 'la confirmación no depende de que el email salga primero',
            weight: 2,
            predicate: { op: 'noVolatileCut', from: { role: 'payment-service' }, to: { role: 'email-sent' } },
            whyMissing: 'no hay ningún componente durable entre el pago y el email.',
            consequence: 'se pierde la confirmación.',
          },
        ],
        rubric: [{ dimension: 'sobrevive a un reinicio', signal: { kind: 'predicate', guaranteeId: 'g-no-volatile-cut' } }],
        // startingDesign carries no `payment-service`/`email-sent` role —
        // this is the exact defect: a guarantee that could never be
        // satisfied by playing, no matter what the player builds.
      }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const message = JSON.stringify(result.error.issues)
      expect(message).toMatch(/payment-service/)
      expect(message).toMatch(/g-no-volatile-cut/)
    }
  })

  it('a guarantee anchored on a role every one of the starting design nodes carries passes [R1-H]', () => {
    const result = exerciseSchema.safeParse(
      validExercise({
        startingDesign: {
          nodes: [
            { id: 'pagos', type: 'service', label: 'Servicio de pagos', zone: 'private', props: {}, role: 'payment-service', given: true },
            { id: 'proveedor', type: 'external-provider', label: 'Proveedor de email', zone: 'dmz', props: {}, role: 'email-sent', given: true },
          ],
          edges: [{ id: 'pagos-proveedor', from: { node: 'pagos' }, to: { node: 'proveedor' } }],
        },
        guarantees: [
          {
            id: 'g-no-volatile-cut',
            label: 'la confirmación no depende de que el email salga primero',
            weight: 2,
            predicate: { op: 'noVolatileCut', from: { role: 'payment-service' }, to: { role: 'email-sent' } },
            whyMissing: 'no hay ningún componente durable entre el pago y el email.',
            consequence: 'se pierde la confirmación.',
          },
        ],
        rubric: [{ dimension: 'sobrevive a un reinicio', signal: { kind: 'predicate', guaranteeId: 'g-no-volatile-cut' } }],
      }),
    )
    expect(result.success).toBe(true)
  })
})
