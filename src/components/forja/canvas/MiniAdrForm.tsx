import { useState } from 'react'
import {
  MAX_MINI_ADR_FIELD_LENGTH,
  MIN_MINI_ADR_CONTENT_CHARACTERS,
  validateMiniAdr,
  type MiniAdr,
  type MiniAdrField,
  type MiniAdrValidationIssueCode,
} from '../../../lib/forja/progression/mastery'

interface FieldCopy {
  label: string
  prompt: string
}

const FIELD_COPY: Record<MiniAdrField, FieldCopy> = {
  optimized: {
    label: 'Qué optimizaste',
    prompt: 'Nombrá la garantía o el resultado que protegiste primero.',
  },
  sacrificed: {
    label: 'Qué aceptaste perder',
    prompt: 'Toda decisión cobra algo. Escribí el costo que decidiste tolerar.',
  },
  whoPays: {
    label: 'Quién absorbe ese costo',
    prompt:
      'Puede ser una persona usuaria, un equipo, operaciones o el negocio.',
  },
  inversionFact: {
    label: 'Qué dato te haría cambiar',
    prompt:
      'Escribí una condición concreta que volvería mejor la alternativa rechazada.',
  },
}

export const MINI_ADR_ISSUE_COPY: Record<MiniAdrValidationIssueCode, string> = {
  required: 'Este razonamiento es necesario para defender la decisión.',
  'too-long': `Usá hasta ${MAX_MINI_ADR_FIELD_LENGTH} caracteres.`,
  'not-articulated': `Escribí al menos dos palabras concretas, con ${MIN_MINI_ADR_CONTENT_CHARACTERS} letras o números en total.`,
  'tradeoff-not-distinct':
    'Lo optimizado y lo sacrificado no pueden ser la misma afirmación.',
}

const EMPTY_ADR: MiniAdr = {
  optimized: '',
  sacrificed: '',
  whoPays: '',
  inversionFact: '',
}

export interface MiniAdrFormProps {
  initial?: Partial<MiniAdr> | null
  saved?: boolean
  transferDemonstrated?: boolean
  onSave: (value: MiniAdr) => void
}

export function MiniAdrForm({
  initial,
  saved = false,
  transferDemonstrated = false,
  onSave,
}: MiniAdrFormProps) {
  const [value, setValue] = useState<MiniAdr>({ ...EMPTY_ADR, ...initial })
  const [issues, setIssues] = useState<
    Partial<Record<MiniAdrField, MiniAdrValidationIssueCode>>
  >({})

  const submit = (event: { preventDefault(): void }) => {
    event.preventDefault()
    const validation = validateMiniAdr(value)
    if (!validation.valid) {
      setIssues(
        Object.fromEntries(
          validation.issues.map((issue) => [issue.field, issue.code]),
        ),
      )
      return
    }
    setIssues({})
    onSave(validation.value)
  }

  return (
    <section
      data-testid="mini-adr"
      aria-labelledby="mini-adr-title"
      className="rounded-md border border-border-card bg-bg-raised p-3 shadow-elevation-1"
    >
      <h3
        id="mini-adr-title"
        className="text-sm font-semibold text-txt-primary"
      >
        El grafo llegó a 100. Ahora defendé la decisión.
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-txt-secondary">
        El motor comprobó la estructura. Esta defensa registra tu criterio sin
        pedirle a una IA que lo puntúe.
      </p>

      <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
        {(Object.keys(FIELD_COPY) as MiniAdrField[]).map((field) => {
          const copy = FIELD_COPY[field]
          const errorId = `mini-adr-${field}-error`
          const promptId = `mini-adr-${field}-prompt`
          return (
            <div key={field}>
              <label
                htmlFor={`mini-adr-${field}`}
                className="block text-xs font-semibold text-txt-primary"
              >
                {copy.label}
              </label>
              <p
                id={promptId}
                className="mt-1 text-xs leading-relaxed text-txt-muted"
              >
                {copy.prompt}
              </p>
              <textarea
                id={`mini-adr-${field}`}
                name={field}
                rows={2}
                maxLength={MAX_MINI_ADR_FIELD_LENGTH}
                value={value[field]}
                aria-invalid={issues[field] ? 'true' : undefined}
                aria-describedby={`${promptId}${issues[field] ? ` ${errorId}` : ''}`}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value
                  setValue((current) => ({
                    ...current,
                    [field]: nextValue,
                  }))
                  setIssues((current) => ({ ...current, [field]: undefined }))
                }}
                className="mt-2 w-full resize-y rounded-md border border-border-card bg-bg-surface px-3 py-2 text-sm leading-relaxed text-txt-primary outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35"
              />
              {issues[field] && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-1 text-xs text-danger-ink"
                >
                  {MINI_ADR_ISSUE_COPY[issues[field]]}
                </p>
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg-deep hover:bg-accent-strong"
          >
            {saved ? 'Actualizar defensa' : 'Guardar defensa'}
          </button>
          {saved && (
            <p role="status" className="text-xs font-medium text-accent-ink">
              {transferDemonstrated
                ? 'Defensa guardada y transferencia demostrada.'
                : 'Defensa guardada. Falta demostrar transferencia en otro ejercicio.'}
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
