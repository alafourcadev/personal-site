import { CATALOG, type PlayerNodePropertyKey } from '../engine/catalog'
import type { ComponentType } from '../engine/types'

export interface PlayerNodePropertyOption {
  value: string
  label: string
  consequence: string
}

export interface PlayerNodePropertyDefinition {
  key: PlayerNodePropertyKey
  label: string
  explanation: string
  options: readonly PlayerNodePropertyOption[]
}

interface PropertyCopy {
  label: string
  explanation: string
  options: Readonly<Record<string, Omit<PlayerNodePropertyOption, 'value'>>>
}

const PROPERTY_COPY: Record<PlayerNodePropertyKey, PropertyCopy> = {
  access: {
    label: 'Acceso',
    explanation: 'Define quién puede descargar el objeto.',
    options: {
      public: {
        label: 'Público',
        consequence: 'Cualquiera con el enlace puede leerlo. Solo sirve para contenido que puede exponerse.',
      },
      signed: {
        label: 'Con enlace firmado',
        consequence: 'Cada acceso necesita autorización y vence. Protege el contenido, pero agrega gestión de permisos.',
      },
    },
  },
  backup: {
    label: 'Respaldo',
    explanation: 'Define cuánto dato podrías perder al restaurar la base.',
    options: {
      none: {
        label: 'Sin respaldo',
        consequence: 'No existe una copia independiente para recuperar datos borrados o dañados.',
      },
      diario: {
        label: 'Diario',
        consequence: 'Podrías perder hasta un día de cambios. La restauración depende de la última copia completa.',
      },
      'cada hora': {
        label: 'Cada hora',
        consequence: 'Reduce la pérdida potencial a una hora, a cambio de más almacenamiento y operación.',
      },
    },
  },
  criticality: {
    label: 'Criticidad',
    explanation: 'Declara el impacto de una caída. Tiene que coincidir con la consigna, no con el puntaje que buscás.',
    options: {
      high: {
        label: 'Alta',
        consequence: 'Una caída afecta una operación central. El diseño necesita redundancia y observabilidad.',
      },
      medium: {
        label: 'Media',
        consequence: 'Una interrupción breve es tolerable. No convierte en secundario un flujo que el negocio marcó como crítico.',
      },
    },
  },
  dlq: {
    label: 'Mensajes fallidos',
    explanation: 'Decide qué pasa con un mensaje que agota sus reintentos.',
    options: {
      no: {
        label: 'Sin cola de fallidos',
        consequence: 'Un mensaje venenoso puede bloquear la cola o perderse sin una ruta explícita de recuperación.',
      },
      sí: {
        label: 'Con cola de fallidos',
        consequence: 'Los mensajes agotados quedan aislados para inspección y reproceso. Alguien debe vigilar esa cola.',
      },
    },
  },
  hosting: {
    label: 'Alojamiento',
    explanation: 'Define dónde se ejecuta el modelo y quién recibe los datos enviados.',
    options: {
      external: {
        label: 'Proveedor externo',
        consequence: 'Simplifica la operación, pero los datos salen de tu control y deben estar autorizados.',
      },
      interno: {
        label: 'Infraestructura interna',
        consequence: 'Los datos quedan bajo tu control. Tu equipo asume capacidad, despliegue y operación del modelo.',
      },
    },
  },
  idempotent: {
    label: 'Idempotencia',
    explanation: 'Define si repetir la misma orden produce un segundo efecto.',
    options: {
      no: {
        label: 'No idempotente',
        consequence: 'Un reintento puede duplicar cobros, reservas o registros.',
      },
      sí: {
        label: 'Idempotente',
        consequence: 'Los reintentos repiten la respuesta sin repetir el efecto. Necesita una clave estable y memoria del resultado.',
      },
    },
  },
  mfa: {
    label: 'Segundo factor',
    explanation: 'Define si una credencial robada basta para entrar.',
    options: {
      opcional: {
        label: 'Opcional',
        consequence: 'Reduce fricción, pero algunas cuentas quedan protegidas por una sola credencial.',
      },
      obligatorio: {
        label: 'Obligatorio',
        consequence: 'Una contraseña robada no basta para entrar. Aumenta la fricción y exige recuperación segura.',
      },
    },
  },
  partitions: {
    label: 'Particiones',
    explanation: 'Define el paralelismo disponible y cómo se reparte el registro de eventos.',
    options: Object.fromEntries(
      ['1', '3', '6', '8', '12', '24', '32'].map((value) => [
        value,
        {
          label: value,
          consequence:
            value === '1'
              ? 'Mantiene un orden total, pero limita el paralelismo a un consumidor activo.'
              : `Permite hasta ${value} líneas de consumo en paralelo. El orden solo se conserva dentro de cada partición.`,
        },
      ]),
    ),
  },
  replicas: {
    label: 'Réplicas',
    explanation: 'Define cuántas instancias pueden atender el servicio.',
    options: {
      '1': {
        label: '1 réplica',
        consequence: 'Cualquier mantenimiento o falla detiene el servicio.',
      },
      '2': {
        label: '2 réplicas',
        consequence: 'Una instancia puede fallar mientras la otra sigue atendiendo. Necesitás balanceo y despliegues coordinados.',
      },
      '3': {
        label: '3 réplicas',
        consequence: 'Tolera una falla con más margen y capacidad. Aumenta consumo y coordinación operativa.',
      },
    },
  },
  sessionRotation: {
    label: 'Rotación de sesión',
    explanation: 'Define si una sesión cambia sus credenciales durante su vida útil.',
    options: {
      no: {
        label: 'Sin rotación',
        consequence: 'Una sesión robada conserva su valor hasta vencer o ser revocada.',
      },
      sí: {
        label: 'Con rotación',
        consequence: 'Reduce la ventana de abuso de una sesión robada. Requiere detectar reutilización y coordinar renovación.',
      },
    },
  },
  sourceTraceability: {
    label: 'Trazabilidad de fuentes',
    explanation: 'Define si cada fragmento puede volver al documento que lo originó.',
    options: {
      no: {
        label: 'Sin trazabilidad',
        consequence: 'Una respuesta no puede demostrar de qué fuente salió ni qué versión usó.',
      },
      sí: {
        label: 'Con trazabilidad',
        consequence: 'Cada resultado conserva fuente y versión. Aumenta metadatos, pero permite auditar y retirar información.',
      },
    },
  },
}

export function playerNodePropertyDefinitions(type: ComponentType): readonly PlayerNodePropertyDefinition[] {
  const editable = CATALOG[type].editableProps ?? {}
  return (Object.entries(editable) as [PlayerNodePropertyKey, readonly string[]][]).map(([key, values]) => {
    const copy = PROPERTY_COPY[key]
    return {
      key,
      label: copy.label,
      explanation: copy.explanation,
      options: values.map((value) => ({ value, ...copy.options[value] })),
    }
  })
}

export function isPlayerNodePropertyValue(
  type: ComponentType,
  key: PlayerNodePropertyKey,
  value: string,
): boolean {
  return CATALOG[type].editableProps?.[key]?.includes(value) ?? false
}

export function playerNodePropertyOption(
  type: ComponentType,
  key: PlayerNodePropertyKey,
  value: string,
): PlayerNodePropertyOption | null {
  return playerNodePropertyDefinitions(type)
    .find((property) => property.key === key)
    ?.options.find((option) => option.value === value) ?? null
}
