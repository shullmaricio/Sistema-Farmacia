// Formatos de Bolivia: moneda en Bs, fechas dia/mes/anio.

export function bs(monto) {
  const n = Number(monto) || 0
  return (
    'Bs ' +
    n.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

export function fecha(valor) {
  if (!valor) return '-'
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function fechaHora(valor) {
  if (!valor) return '-'
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return '-'
  return (
    fecha(d) +
    ' ' +
    d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  )
}

// Convierte una fecha a "2026-09-17" para los inputs type="date".
export function aInputFecha(valor) {
  if (!valor) return ''
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function diasHasta(valor) {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = new Date(d)
  objetivo.setHours(0, 0, 0, 0)
  return Math.round((objetivo - hoy) / 86400000)
}

// Devuelve el estado de vencimiento de un lote segun los umbrales configurados.
export function estadoVencimiento(fechaVenc, config) {
  const dias = diasHasta(fechaVenc)
  if (dias === null) return { nivel: 'sin-fecha', dias: null, texto: 'Sin fecha' }
  if (dias < 0)
    return { nivel: 'vencido', dias, texto: `Vencido hace ${Math.abs(dias)} d` }
  const critico = config?.diasAlertaVencimientoCritico ?? 30
  const aviso = config?.diasAlertaVencimiento ?? 90
  if (dias <= critico)
    return { nivel: 'critico', dias, texto: `Vence en ${dias} d` }
  if (dias <= aviso) return { nivel: 'aviso', dias, texto: `Vence en ${dias} d` }
  return { nivel: 'ok', dias, texto: fecha(fechaVenc) }
}

// Traduce el nivel de estadoVencimiento() a una clase de insignia (.insignia-*
// definida en index.css), para no repetir el mismo if/else en cada pantalla.
export function claseInsigniaVencimiento(nivel) {
  if (nivel === 'vencido' || nivel === 'critico') return 'insignia-peligro'
  if (nivel === 'aviso') return 'insignia-aviso'
  if (nivel === 'sin-fecha') return 'insignia-neutra'
  return 'insignia-ok'
}
