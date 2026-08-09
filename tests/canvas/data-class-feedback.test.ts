// What the status bar says when a player declares what travels through a
// connection — and, when that declaration turns a legal design into an illegal
// one, why that is not the game punishing them for telling the truth.
//
// Three of the engine's rules only ever fire on an edge that HAS a
// `dataClass` (volatile-durable-mismatch, pii-to-external-model,
// regulated-without-backup). Until the player could declare one, none of them
// could reach a connection the player drew. Now they can, which means the
// gesture has a second-order effect the other gestures do not have: declaring
// a fact can block the design.
//
// The precedent for a refused connection (ForjaCanvas's announceVerdict) is
// deliberately NOT followed for the declaration itself. A refused connection is
// about something that cannot exist; a declaration is about something that is
// already true. Refusing it would teach the player that the way to keep a
// design legal is to not say what travels — the exact opposite of the lesson 16
// exercises are built on. So the declaration always commits, and the message
// carries the consequence instead of the refusal.
import { describe, expect, it } from 'vitest'
import { dataClassMessage, newlyBlockingFindings } from '../../src/lib/forja/canvas/data-class-feedback'
import type { Finding } from '../../src/lib/forja/engine/types'

const finding = (over: Partial<Finding> & Pick<Finding, 'rule'>): Finding => ({
  id: `${over.rule}:0`,
  severity: 'blocking',
  title: 'Título',
  evidence: 'evidencia',
  why: 'porque sí',
  nodeIds: [],
  edgeIds: ['e1'],
  ...over,
})

describe('newlyBlockingFindings — only what the declaration itself caused', () => {
  it('reports a blocking finding that reaches this connection and was not there before', () => {
    const before: Finding[] = []
    const after = [finding({ rule: 'volatile-durable-mismatch' })]

    expect(newlyBlockingFindings(before, after, 'e1').map((f) => f.rule)).toEqual(['volatile-durable-mismatch'])
  })

  // The connection may already have been illegal for a reason that has nothing
  // to do with what travels through it — a trust-zone jump is about WHERE the
  // two boxes sit. Repeating it now would blame the declaration for it.
  it('ignores a blocking finding the connection already carried', () => {
    const before = [finding({ rule: 'trust-zone-jump' })]
    const after = [finding({ rule: 'trust-zone-jump' }), finding({ rule: 'pii-to-external-model' })]

    expect(newlyBlockingFindings(before, after, 'e1').map((f) => f.rule)).toEqual(['pii-to-external-model'])
  })

  it('ignores a blocking finding about some other connection', () => {
    const after = [finding({ rule: 'volatile-durable-mismatch', edgeIds: ['e2'] })]

    expect(newlyBlockingFindings([], after, 'e1')).toEqual([])
  })

  // `undeclared-data-class` is a note, and closing it is the whole point of the
  // gesture — it is never news.
  it('ignores everything that is not blocking', () => {
    const after = [finding({ rule: 'undeclared-data-class', severity: 'note' })]

    expect(newlyBlockingFindings([], after, 'e1')).toEqual([])
  })

  // `regulated-without-backup` is raised against the NODE (its evidence is the
  // database, its edgeIds are empty), yet it is a direct consequence of
  // declaring regulated data on the connection that reaches it. Matching only
  // by `edgeIds` would have left the player with a design that just went
  // illegal and a status bar that said nothing about it.
  it('reports a new blocking finding raised on the node the connection reaches', () => {
    const after = [finding({ rule: 'regulated-without-backup', edgeIds: [], nodeIds: ['n2'] })]

    expect(newlyBlockingFindings([], after, 'e1', ['n2']).map((f) => f.rule)).toEqual(['regulated-without-backup'])
  })

  it('still ignores a node finding about a node the connection does not touch', () => {
    const after = [finding({ rule: 'regulated-without-backup', edgeIds: [], nodeIds: ['n9'] })]

    expect(newlyBlockingFindings([], after, 'e1', ['n1', 'n2'])).toEqual([])
  })
})

describe('dataClassMessage — the status bar announces the declaration', () => {
  it('names the class and the connection, like every other announcement names what it acted on', () => {
    expect(dataClassMessage('de Servicio de altas a Caché', 'dato regulado', [])).toBe(
      'Declaraste dato regulado en la conexión de Servicio de altas a Caché.',
    )
  })

  it('says so when the player takes the declaration back', () => {
    expect(dataClassMessage('de Servicio de altas a Caché', null, [])).toBe(
      'Quitaste la clase de dato de la conexión de Servicio de altas a Caché.',
    )
  })

  // The sentence that carries the lesson. It says three things in order: the
  // declaration was kept, the problem is not new, and here is what it is.
  it('explains that the design turned illegal without blaming the declaration for it', () => {
    const message = dataClassMessage('de Servicio de altas a Caché', 'dato regulado', [
      finding({ title: 'Dato sensible en almacenamiento volátil', why: 'Un reinicio borra el dato.', rule: 'volatile-durable-mismatch' }),
    ])

    expect(message).toBe(
      'Declaraste dato regulado en la conexión de Servicio de altas a Caché. ' +
        'La declaración se guardó: no apareció un problema nuevo, se volvió visible el que ya estaba. ' +
        'Bloqueante: Dato sensible en almacenamiento volátil. Un reinicio borra el dato.',
    )
  })

  it('carries every new blocking finding, never just the first', () => {
    const message = dataClassMessage('de A a B', 'dato personal', [
      finding({ rule: 'volatile-durable-mismatch', title: 'Primero', why: 'Porque uno.' }),
      finding({ rule: 'pii-to-external-model', title: 'Segundo', why: 'Porque dos.' }),
    ])

    expect(message).toContain('Bloqueantes: Primero · Segundo.')
    expect(message).toContain('Porque uno. Porque dos.')
  })

  // Taking a declaration back can only ever REMOVE a dataClass-driven finding,
  // so there is nothing new to report — and reporting one would be incoherent.
  it('never appends a consequence to a cleared declaration', () => {
    expect(dataClassMessage('de A a B', null, [finding({ rule: 'volatile-durable-mismatch' })])).toBe(
      'Quitaste la clase de dato de la conexión de A a B.',
    )
  })
})
