import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  MINI_ADR_ISSUE_COPY,
  MiniAdrForm,
} from '../../src/components/forja/canvas/MiniAdrForm'

describe('MiniAdrForm', () => {
  it('elicits the tradeoff without promising an AI judgment', () => {
    const markup = renderToStaticMarkup(createElement(MiniAdrForm, { onSave: () => undefined }))

    expect(markup).toContain('Qué optimizaste')
    expect(markup).toContain('Qué aceptaste perder')
    expect(markup).toContain('Quién absorbe ese costo')
    expect(markup).toContain('Qué dato te haría cambiar')
    expect(markup).toContain('sin pedirle a una IA que lo puntúe')
    expect(markup).toContain('Guardar defensa')
  })

  it('shows the transfer requirement after the defense was saved', () => {
    const markup = renderToStaticMarkup(
      createElement(MiniAdrForm, {
        saved: true,
        initial: {
          optimized: 'Disponibilidad',
          sacrificed: 'Costo operativo',
          whoPays: 'El equipo de plataforma',
          inversionFact: 'Menos de cien operaciones por día',
        },
        onSave: () => undefined,
      }),
    )

    expect(markup).toContain('Actualizar defensa')
    expect(markup).toContain('Falta demostrar transferencia')
  })

  it('keeps a specific accessible recovery message beside invalid fields', () => {
    const markup = renderToStaticMarkup(createElement(MiniAdrForm, { onSave: () => undefined }))

    expect(MINI_ADR_ISSUE_COPY['not-articulated']).toContain(
      'Escribí al menos dos palabras concretas',
    )
    expect(markup).toContain('aria-describedby="mini-adr-optimized-prompt"')
  })
})
