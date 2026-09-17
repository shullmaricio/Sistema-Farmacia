import { db, TIPOS_CONTROLADO } from './db'

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

// ---------------------------------------------------------------------------
// Productos: alta, edicion, baja logica y validaciones.
// Regla del brief: nunca eliminar fisicamente un producto que ya tenga
// lotes o movimientos. Para eso existe "activo": false.
// ---------------------------------------------------------------------------

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : valor
}

function numeroOCero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export async function validarProducto(datos, { idActual = null } = {}) {
  const errores = []

  if (!limpiarTexto(datos.nombreComercial)) {
    errores.push('El nombre comercial es obligatorio.')
  }
  if (numeroOCero(datos.precioCompra) < 0) {
    errores.push('El precio de compra no puede ser negativo.')
  }
  if (numeroOCero(datos.precioVenta) < 0) {
    errores.push('El precio de venta no puede ser negativo.')
  }
  if (numeroOCero(datos.stockMinimo) < 0) {
    errores.push('El stock minimo no puede ser negativo.')
  }
  if (!Object.keys(TIPOS_CONTROLADO).includes(datos.esControlado || 'ninguno')) {
    errores.push('El tipo de control seleccionado no es valido.')
  }

  const codigoBarras = limpiarTexto(datos.codigoBarras)
  if (codigoBarras) {
    const existente = await db.productos.where('codigoBarras').equals(codigoBarras).first()
    if (existente && existente.id !== idActual) {
      errores.push(`Ya existe "${existente.nombreComercial}" con ese codigo de barras.`)
    }
  }

  const codigoInterno = limpiarTexto(datos.codigoInterno)
  if (codigoInterno) {
    const todos = await db.productos.toArray()
    const existente = todos.find(
      (p) =>
        (p.codigoInterno || '').toLowerCase() === codigoInterno.toLowerCase() &&
        p.id !== idActual
    )
    if (existente) {
      errores.push(`Ya existe "${existente.nombreComercial}" con ese codigo interno.`)
    }
  }

  if (errores.length) {
    throw new Error(errores.join(' '))
  }
}

export async function generarCodigoInterno() {
  const total = await db.productos.count()
  return `P-${String(total + 1).padStart(4, '0')}`
}

export async function crearProducto(datos) {
  await validarProducto(datos, {})
  const codigoInterno = limpiarTexto(datos.codigoInterno) || (await generarCodigoInterno())
  return db.productos.add({
    nombreComercial: limpiarTexto(datos.nombreComercial),
    principioActivo: limpiarTexto(datos.principioActivo) || '',
    categoriaId: datos.categoriaId ?? null,
    laboratorio: limpiarTexto(datos.laboratorio) || '',
    presentacion: limpiarTexto(datos.presentacion) || '',
    concentracion: limpiarTexto(datos.concentracion) || '',
    unidadMedida: limpiarTexto(datos.unidadMedida) || '',
    codigoBarras: limpiarTexto(datos.codigoBarras) || '',
    codigoInterno,
    precioCompra: numeroOCero(datos.precioCompra),
    precioVenta: numeroOCero(datos.precioVenta),
    stockMinimo: numeroOCero(datos.stockMinimo),
    ubicacion: limpiarTexto(datos.ubicacion) || '',
    proveedorPrincipalId: datos.proveedorPrincipalId ?? null,
    requiereReceta: !!datos.requiereReceta,
    esControlado: datos.esControlado || 'ninguno',
    activo: datos.activo !== false,
    creadoEn: new Date(),
  })
}

export async function actualizarProducto(id, datos) {
  await validarProducto(datos, { idActual: id })
  return db.productos.update(id, {
    nombreComercial: limpiarTexto(datos.nombreComercial),
    principioActivo: limpiarTexto(datos.principioActivo) || '',
    categoriaId: datos.categoriaId ?? null,
    laboratorio: limpiarTexto(datos.laboratorio) || '',
    presentacion: limpiarTexto(datos.presentacion) || '',
    concentracion: limpiarTexto(datos.concentracion) || '',
    unidadMedida: limpiarTexto(datos.unidadMedida) || '',
    codigoBarras: limpiarTexto(datos.codigoBarras) || '',
    codigoInterno: limpiarTexto(datos.codigoInterno) || undefined,
    precioCompra: numeroOCero(datos.precioCompra),
    precioVenta: numeroOCero(datos.precioVenta),
    stockMinimo: numeroOCero(datos.stockMinimo),
    ubicacion: limpiarTexto(datos.ubicacion) || '',
    proveedorPrincipalId: datos.proveedorPrincipalId ?? null,
    requiereReceta: !!datos.requiereReceta,
    esControlado: datos.esControlado || 'ninguno',
  })
}

export async function cambiarEstadoProducto(id, activo) {
  return db.productos.update(id, { activo: !!activo })
}

// Solo permite borrar de verdad un producto recien creado, sin historial.
// Si ya tiene lotes o movimientos, hay que desactivarlo en su lugar.
export async function eliminarProductoSiEsPosible(id) {
  const [tieneLotes, tieneMovimientos] = await Promise.all([
    db.lotes.where('productoId').equals(id).count(),
    db.movimientos.where('productoId').equals(id).count(),
  ])
  if (tieneLotes > 0 || tieneMovimientos > 0) {
    throw new Error(
      'Este producto ya tiene lotes o movimientos registrados. Desactivalo en vez de eliminarlo.'
    )
  }
  return db.productos.delete(id)
}

// ---------------------------------------------------------------------------
// Lotes: alta manual y ajustes. Mientras el modulo de Compras no exista,
// esta es la unica forma de meter stock nuevo al sistema.
// ---------------------------------------------------------------------------

export async function listarLotesDeProducto(productoId) {
  const lotes = await db.lotes.where('productoId').equals(productoId).toArray()
  return lotes.sort((a, b) => {
    const fa = a.fechaVencimiento ? new Date(a.fechaVencimiento).getTime() : Infinity
    const fb = b.fechaVencimiento ? new Date(b.fechaVencimiento).getTime() : Infinity
    return fa - fb
  })
}

export async function crearLoteManual({
  productoId,
  numeroLote,
  fechaVencimiento,
  fechaIngreso,
  cantidadInicial,
  costoUnitario,
  proveedorId,
  usuario = '',
}) {
  const cantidad = Number(cantidadInicial)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad inicial del lote debe ser mayor a cero.')
  }
  if (!fechaVencimiento || Number.isNaN(new Date(fechaVencimiento).getTime())) {
    throw new Error('La fecha de vencimiento no es valida.')
  }
  const costo = Number(costoUnitario)
  if (!Number.isFinite(costo) || costo < 0) {
    throw new Error('El costo del lote no puede ser negativo.')
  }

  return db.transaction('rw', db.lotes, db.movimientos, async () => {
    const loteId = await db.lotes.add({
      productoId,
      numeroLote: limpiarTexto(numeroLote) || '',
      fechaVencimiento,
      fechaIngreso: fechaIngreso || new Date().toISOString().slice(0, 10),
      cantidadInicial: cantidad,
      cantidadActual: cantidad,
      costoUnitario: costo,
      proveedorId: proveedorId ?? null,
      compraId: null,
    })
    await registrarMovimiento({
      tipo: 'compra',
      productoId,
      loteId,
      cantidad,
      saldoResultante: cantidad,
      referenciaTipo: 'entrada-manual',
      motivo: 'Entrada manual de stock (el modulo de Compras aun no esta implementado)',
      usuario,
    })
    return loteId
  })
}

// Suma unidades a un lote existente (ej. correccion de un conteo fisico).
export async function incrementarLote({ loteId, productoId, cantidad, motivo = '', usuario = '' }) {
  const n = Number(cantidad)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('La cantidad a sumar debe ser mayor a cero.')
  }
  const lote = await db.lotes.get(loteId)
  if (!lote) throw new Error('El lote ya no existe.')
  const nuevoSaldo = (lote.cantidadActual || 0) + n
  await db.lotes.update(loteId, { cantidadActual: nuevoSaldo })
  await registrarMovimiento({
    tipo: 'ajuste',
    productoId,
    loteId,
    cantidad: n,
    saldoResultante: nuevoSaldo,
    referenciaTipo: 'ajuste-manual',
    motivo: motivo || 'Ajuste manual (incremento)',
    usuario,
  })
  return nuevoSaldo
}

// Resta unidades de un lote por una razon distinta a una venta (merma,
// vencimiento, correccion de conteo). El motivo es obligatorio a proposito:
// todo cambio de stock debe quedar explicado en el historial.
export async function restarLoteManual({
  loteId,
  productoId,
  cantidad,
  tipo = 'ajuste',
  motivo = '',
  usuario = '',
}) {
  if (!limpiarTexto(motivo)) {
    throw new Error('El motivo es obligatorio para restar stock manualmente.')
  }
  return descontarLote({
    loteId,
    productoId,
    cantidad: Number(cantidad),
    tipo,
    referenciaTipo: 'ajuste-manual',
    motivo,
    usuario,
  })
}

// ---------------------------------------------------------------------------
// Altas rapidas de categoria y proveedor desde el formulario de producto.
// Los modulos completos de Categorias/Proveedores llegan en otra entrega;
// esto evita bloquear la carga de un producto mientras tanto.
// ---------------------------------------------------------------------------

export async function crearCategoriaRapida(nombre) {
  const limpio = limpiarTexto(nombre)
  if (!limpio) throw new Error('El nombre de la categoria es obligatorio.')
  const existente = (await db.categorias.toArray()).find(
    (c) => c.nombre.toLowerCase() === limpio.toLowerCase()
  )
  if (existente) return existente.id
  return db.categorias.add({ nombre: limpio })
}

export async function crearProveedorRapido(nombre) {
  const limpio = limpiarTexto(nombre)
  if (!limpio) throw new Error('El nombre del proveedor es obligatorio.')
  const existente = (await db.proveedores.toArray()).find(
    (p) => p.nombre.toLowerCase() === limpio.toLowerCase()
  )
  if (existente) return existente.id
  return db.proveedores.add({
    nombre: limpio,
    nit: '',
    telefono: '',
    whatsapp: '',
    direccion: '',
    email: '',
    contacto: '',
    notas: '',
    activo: true,
  })
}

// ---------------------------------------------------------------------------
// Resumen de inventario: stock total y proximo vencimiento por producto.
// Lo usa la pantalla de Inventario y, mas adelante, el Dashboard.
// ---------------------------------------------------------------------------

export function resumenPorProducto(lotes) {
  const mapa = new Map()
  for (const lote of lotes) {
    const actual = mapa.get(lote.productoId) || { stock: 0, proximoVencimiento: null }
    actual.stock += lote.cantidadActual || 0
    if ((lote.cantidadActual || 0) > 0 && lote.fechaVencimiento) {
      if (
        !actual.proximoVencimiento ||
        new Date(lote.fechaVencimiento) < new Date(actual.proximoVencimiento)
      ) {
        actual.proximoVencimiento = lote.fechaVencimiento
      }
    }
    mapa.set(lote.productoId, actual)
  }
  return mapa
}
