import { CATALOG, type PlayerNodePropertyKey } from '../engine/catalog'
import { evaluate } from '../engine'
import type { ComponentType, Design, DesignEdge, DesignNode, Evaluation, ExerciseSpec } from '../engine/types'
import { isPlayerNodePropertyValue, playerNodePropertyDefinitions } from './node-properties'

export type PlayerPropertyCapability = (
  type: ComponentType,
  key: string,
  value: string,
) => boolean

export interface InaccessibleNodeProperty {
  nodeId: string
  type: ComponentType
  key: string
  value: string
}

export interface PlayerReachableReference {
  design: Design
  inaccessibleProperties: InaccessibleNodeProperty[]
}

export interface BestPlayerReachableReference extends PlayerReachableReference {
  evaluation: Evaluation
}

export const PLAYER_PROPERTY_CAPABILITY: PlayerPropertyCapability = (type, key, value) =>
  isPlayerNodePropertyValue(type, key as PlayerNodePropertyKey, value)

export const NO_NODE_PROPERTY_CAPABILITY: PlayerPropertyCapability = () => false

function startingVersion(reference: DesignNode, startingById: ReadonlyMap<string, DesignNode>): DesignNode | null {
  const starting = startingById.get(reference.id)
  return starting?.type === reference.type ? starting : null
}

// Rebuilds a published answer through the same facts a player can control.
// Topology, labels and positions are public gestures. New nodes start with the
// catalog defaults. Existing nodes keep the exercise facts they opened with.
// Only declared property choices and edge data classes may then change.
export function playerReachableReference(
  startingDesign: Design,
  referenceDesign: Design,
  canSetProperty: PlayerPropertyCapability = PLAYER_PROPERTY_CAPABILITY,
): PlayerReachableReference {
  const startingById = new Map(startingDesign.nodes.map((node) => [node.id, node]))
  const inaccessibleProperties: InaccessibleNodeProperty[] = []

  const nodes = referenceDesign.nodes.map((reference): DesignNode => {
    const starting = startingVersion(reference, startingById)
    const catalog = CATALOG[reference.type]
    const props = { ...(starting?.props ?? catalog.props) }

    for (const [key, value] of Object.entries(reference.props)) {
      if (props[key] === value) continue
      if (canSetProperty(reference.type, key, value)) {
        props[key] = value
      } else {
        inaccessibleProperties.push({ nodeId: reference.id, type: reference.type, key, value })
      }
    }

    return {
      id: reference.id,
      type: reference.type,
      label: reference.label,
      zone: starting?.zone ?? catalog.zone,
      props,
      role: starting?.role,
      given: starting?.given,
      position: reference.position,
    }
  })

  const edges = referenceDesign.edges.map(
    (reference): DesignEdge => ({
      id: reference.id,
      from: { node: reference.from.node },
      to: { node: reference.to.node },
      dataClass: reference.dataClass,
    }),
  )

  return { design: { nodes, edges }, inaccessibleProperties }
}

function evaluationRank(evaluation: Evaluation): readonly [number, number, number] {
  if (evaluation.status === 'illegal') {
    const blockers = evaluation.findings.filter((finding) => finding.severity === 'blocking').length
    return [-1, -blockers, -evaluation.findings.length]
  }
  return [evaluation.score ?? -1, 0, -evaluation.findings.length]
}

function ranksHigher(candidate: Evaluation, current: Evaluation): boolean {
  const a = evaluationRank(candidate)
  const b = evaluationRank(current)
  return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
}

function withNodeProperty(design: Design, nodeId: string, key: PlayerNodePropertyKey, value: string): Design {
  return {
    ...design,
    nodes: design.nodes.map((node) =>
      node.id === nodeId ? { ...node, props: { ...node.props, [key]: value } } : node,
    ),
  }
}

// Finds a concrete, reproducible 100-point path on the reference topology.
// Some older references omit properties entirely, which made a rule stay
// silent even though a player-created node receives catalog defaults. The
// coordinate pass tries every exposed value through the real engine and only
// keeps a change that improves the verdict. It never invents a hidden value.
export function bestPlayerReachableReference(
  startingDesign: Design,
  referenceDesign: Design,
  exercise: ExerciseSpec,
  canSetProperty: PlayerPropertyCapability = PLAYER_PROPERTY_CAPABILITY,
): BestPlayerReachableReference {
  const reachable = playerReachableReference(startingDesign, referenceDesign, canSetProperty)
  let design = reachable.design
  let evaluation = evaluate(design, exercise)
  let improved = true

  while (improved && !(evaluation.status === 'scored' && evaluation.score === 100)) {
    improved = false
    for (const node of design.nodes) {
      for (const property of playerNodePropertyDefinitions(node.type)) {
        for (const option of property.options) {
          if (!canSetProperty(node.type, property.key, option.value) || node.props[property.key] === option.value) continue
          const candidateDesign = withNodeProperty(design, node.id, property.key, option.value)
          const candidateEvaluation = evaluate(candidateDesign, exercise)
          if (!ranksHigher(candidateEvaluation, evaluation)) continue
          design = candidateDesign
          evaluation = candidateEvaluation
          improved = true
        }
      }
    }
  }

  return { ...reachable, design, evaluation }
}
