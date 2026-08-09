import { useId } from 'react'
import type { PlayerNodePropertyKey } from '../../../lib/forja/engine/catalog'
import type { DesignNode } from '../../../lib/forja/engine/types'
import {
  playerNodePropertyDefinitions,
  playerNodePropertyOption,
} from '../../../lib/forja/playground/node-properties'

export interface NodePropertyEditorProps {
  node: DesignNode | null
  onChange: (nodeId: string, key: PlayerNodePropertyKey, value: string) => void
  className?: string
}

export function NodePropertyEditor({ node, onChange, className = '' }: NodePropertyEditorProps) {
  const instanceId = useId()
  if (!node) return null

  const properties = playerNodePropertyDefinitions(node.type)
  if (properties.length === 0) return null

  const titleId = `${instanceId}-title`
  return (
    <section className={`min-w-0 border-t border-border-card px-3 py-4 ${className}`} aria-labelledby={titleId}>
      <div className="mb-4 min-w-0">
        <h3 id={titleId} className="break-words text-sm font-semibold text-txt-primary">
          Decisiones de {node.label}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-txt-secondary">
          Cada cambio modifica una decisión que el motor puede evaluar. Elegí según la consigna y revisá el costo que aceptás.
        </p>
      </div>

      <div className="space-y-5">
        {properties.map((property) => {
          const selectId = `${instanceId}-${property.key}`
          const consequenceId = `${selectId}-consequence`
          const explanationId = `${selectId}-explanation`
          const currentValue = node.props[property.key] ?? ''
          const currentOption = playerNodePropertyOption(node.type, property.key, currentValue)
          const hasMissingValue = currentValue === ''
          const hasUnknownValue = currentValue !== '' && !currentOption

          return (
            <div key={property.key} className="min-w-0">
              <label htmlFor={selectId} className="mb-1 block text-xs font-semibold text-txt-primary">
                {property.label}
              </label>
              <p id={explanationId} className="mb-2 text-xs leading-relaxed text-txt-muted">
                {property.explanation}
              </p>
              <select
                id={selectId}
                value={currentValue}
                aria-label={`${property.label} de ${node.label}`}
                aria-describedby={`${explanationId} ${consequenceId}`}
                onChange={(event) => onChange(node.id, property.key, event.currentTarget.value)}
                className="min-h-11 w-full rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm text-txt-primary outline-none transition-colors hover:border-border-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35"
              >
                {hasMissingValue ? <option value="" disabled>Sin declarar</option> : null}
                {hasUnknownValue ? <option value={currentValue}>Valor actual: {currentValue}</option> : null}
                {property.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p
                id={consequenceId}
                aria-live="polite"
                className="mt-2 break-words text-xs leading-relaxed text-txt-secondary"
              >
                {currentOption?.consequence ?? 'Elegí un valor válido para que el motor pueda evaluar esta decisión.'}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
