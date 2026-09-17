import { db } from './db'

// ---------------------------------------------------------------------------
// Stock: NUNCA se guarda como un numero suelto en el producto.
// El stock real es siempre la suma de los lotes vivos de ese producto.
// Asi no puede quedar "descuadrado" entre dos lugares distintos.
// ---------------------------------------------------------------------------

export async function stockDeProducto(productoId) {
  const lotes = await db.lotes.where('productoId').equals(productoId).toArray()
  return lotes.reduce((suma, l) => suma + (l.cantidadActual || 0), 0)
}

// Version rapida para listas largas: calcula el stock de todos los productos
// de una sola pasada, en vez de consultar la base una vez por producto.
export async function stockDeTodos() {
  const lotes = await db.lotes.toArray()
  const mapa = new Map()
  for (const l of lotes) {
    mapa.set(l.productoId, (mapa.get(l.productoId) || 0) + (l.cantidadActual || 0))
  }
  return mapa
}

// ---------------------------------------------------------------------------
// FEFO: "first expired, first out" — primero vence, primero sale.
// Devuelve de que lotes habria que sacar una cantidad pedida, en orden.
// No toca la base: solo calcula el plan. Quien vende decide si lo confirma.
// ---------------------------------------------------------------------------

export async function planFEFO(productoId, cantidad, { permitirVencido = false } = {}) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const lotes = (await db.lotes.where('productoId').equals(productoId).toArray())
    .filter((l) => (l.cantidadActual || 0) > 0)
    .sort((a, b) => {
      const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity
      const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity
      return fa - fb
    })

  const asignaciones = []
  let restante = cantidad
  let hayVencidos = false

  for (const lote of lotes) {
    if (restante <= 0) break
    const vencido =
      lote.fechaVencimiento && new Date(lote.fechaVencimiento) < hoy
    if (vencido) {
      hayVencidos = true
      if (!permitirVencido) continue
    }
    const tomar = Math.min(restante, lote.cantidadActual)
    asignaciones.push({
      loteId: lote.id,
      numeroLote: lote.numeroLote,
      fechaVencimiento: lote.fechaVencimiento,
      costoUnitario: lote.costoUnitario,
      cantidad: tomar,
      vencido,
    })
    restante -= tomar
  }

  return {
    asignaciones,
    faltante: restante,
    suficiente: restante <= 0,
    hayVencidos,
  }
}

// ---------------------------------------------------------------------------
// Movimientos de inventario: registro append-only de todo lo que toca stock.
// Sirve para auditar despues "por que este lote tiene 3 unidades menos".
// ---------------------------------------------------------------------------

export async function registrarMovimiento(mov) {
  return db.movimientos.add({
    fecha: new Date(),
    tipo: mov.tipo,
    productoId: mov.productoId,
    loteId: mov.loteId ?? null,
    cantidad: mov.cantidad,
    saldoResultante: mov.saldoResultante ?? null,
    referenciaTipo: mov.referenciaTipo ?? null,
    referenciaId: mov.referenciaId ?? null,
    motivo: mov.motivo ?? '',
    usuario: mov.usuario ?? '',
  })
}

// Descuenta de un lote y deja constancia. Se usa dentro de una transaccion.
export async function descontarLote({
  loteId,
  productoId,
  cantidad,
  tipo = 'venta',
  referenciaTipo = null,
  referenciaId = null,
  motivo = '',
  usuario = '',
}) {
  const lote = await db.lotes.get(loteId)
  if (!lote) throw new Error('El lote ya no existe.')
  if (lote.cantidadActual < cantidad) {
    throw new Error(
      `El lote ${lote.numeroLote || loteId} solo tiene ${lote.cantidadActual} unidades.`
    )
  }
  const nuevoSaldo = lote.cantidadActual - cantidad
  await db.lotes.update(loteId, { cantidadActual: nuevoSaldo })
  await registrarMovimiento({
    tipo,
    productoId,
    loteId,
    cantidad: -cantidad,
    saldoResultante: nuevoSaldo,
    referenciaTipo,
    referenciaId,
    motivo,
    usuario,
  })
  return nuevoSaldo
}

// ---------------------------------------------------------------------------
// Unidades de venta: un producto se controla en "unidad base" (la mas chica),
// y se puede vender en presentaciones mas grandes con su propio precio.
// Ej: base = comprimido; caja = factor 20; blister = factor 10.
// ---------------------------------------------------------------------------

export function unidadBasePorDefecto() {
  return {
    tipo: 'unidad',
    etiqueta: 'Unidad',
    factorConversion: 1,
    precioVenta: 0,
  }
}

export function totalUnidadesBase(unidadVenta, cantidad) {
  const factor = Number(unidadVenta?.factorConversion) || 1
  return factor * (Number(cantidad) || 0)
}
