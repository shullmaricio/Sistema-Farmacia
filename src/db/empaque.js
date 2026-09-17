// ---------------------------------------------------------------------------
// Empaque: como viene un producto (caja, blister, unidad) y como se vende.
//
// Regla base del sistema (ver operaciones.js): el stock de un lote
// (cantidadActual) siempre esta en la UNIDAD MAS CHICA que se vende. La caja
// y el blister nunca se guardan como stock aparte: son solo una forma de
// contar y de cobrar esa misma cantidad.
//
// Este archivo no toca la base de datos. Son funciones puras: reciben un
// producto (o un numero) y devuelven un resultado. Los componentes las usan
// para no repetir la misma cuenta en cada pantalla.
// ---------------------------------------------------------------------------

export const UNIDADES_BASE = [
  'Comprimido',
  'Capsula',
  'Sobre',
  'Ampolla',
  'Frasco',
  'Tubo',
  'Unidad',
]

// Un producto recien creado no tiene ninguna forma de venta extra: solo se
// vende por unidad, al precioVenta de siempre. Esto es a proposito: no
// obliga a nadie a configurar cajas ni blisters si no los necesita.
export function productoVacioEmpaque() {
  return {
    unidadBase: 'Unidad',
    permiteFraccionar: true,
    formasVenta: [],
  }
}

// Arma la lista completa de formas en las que se puede vender un producto:
// la unidad base (que sale de precioVenta/codigoBarras, los campos de
// siempre) mas las formas extra que se hayan cargado (blister, caja, etc).
export function formasVentaCompletas(producto) {
  const unidad = {
    id: 'unidad',
    etiqueta: producto.unidadBase || 'Unidad',
    factor: 1,
    precio: Number(producto.precioVenta) || 0,
    codigoBarras: producto.codigoBarras || '',
    activa: true,
  }
  const extras = (producto.formasVenta || []).filter((f) => f.activa !== false)

  if (producto.permiteFraccionar === false) {
    // No se puede fraccionar: solo se vende en la forma mas grande activa.
    const todas = [unidad, ...extras]
    const mayor = todas.reduce((a, b) => (b.factor > a.factor ? b : a))
    return [mayor]
  }

  return [unidad, ...extras].sort((a, b) => a.factor - b.factor)
}

export function formaVentaPorDefecto(producto) {
  const formas = formasVentaCompletas(producto)
  return formas.find((f) => f.factor > 1) ? formas[formas.length - 1] : formas[0]
}

// Cuantas unidades base representa "cantidad" veces esta forma de venta.
// Ej: 3 cajas de factor 100 -> 300.
export function aUnidadesBase(cantidad, formaVenta) {
  const factor = Number(formaVenta?.factor) || 1
  return Math.round((Number(cantidad) || 0) * factor)
}

// Costo por unidad base a partir de lo que se pago por la forma comprada.
// Ej: pague Bs 130 por caja (factor 100) -> Bs 1.30 por comprimido.
export function costoUnitarioDesde(costoDeLaForma, formaVenta) {
  const factor = Number(formaVenta?.factor) || 1
  return Math.round(((Number(costoDeLaForma) || 0) / factor) * 100) / 100
}

// Descompone un total de unidades base en piezas completas (de mayor a
// menor) mas el resto suelto. No asume que existan "caja" y "blister": usa
// las formas de venta activas del producto, cualquiera sea su nombre.
export function desglosarStock(unidadesTotales, producto) {
  const formas = (producto.formasVenta || [])
    .filter((f) => f.activa !== false && Number(f.factor) > 1)
    .sort((a, b) => b.factor - a.factor)

  let resto = Math.max(0, Math.round(Number(unidadesTotales) || 0))
  const piezas = []
  for (const forma of formas) {
    const factor = Number(forma.factor)
    const cuantas = Math.floor(resto / factor)
    if (cuantas > 0) {
      piezas.push({ etiqueta: forma.etiqueta, cantidad: cuantas })
      resto -= cuantas * factor
    }
  }
  return { piezas, sueltas: resto }
}

// "487 comprimidos (4 cajas + 8 blisters + 7 sueltos)"
export function formatearStock(unidadesTotales, producto) {
  const total = Math.max(0, Math.round(Number(unidadesTotales) || 0))
  const etiquetaBase = (producto.unidadBase || 'unidad').toLowerCase()
  const base = `${total} ${etiquetaBase}${total === 1 ? '' : 's'}`

  const { piezas, sueltas } = desglosarStock(total, producto)
  if (!piezas.length) return base

  const partes = piezas.map(
    (p) => `${p.cantidad} ${p.etiqueta.toLowerCase()}${p.cantidad === 1 ? '' : 's'}`
  )
  if (sueltas > 0) partes.push(`${sueltas} suelto${sueltas === 1 ? '' : 's'}`)
  return `${base} (${partes.join(' + ')})`
}

// Avisos para mostrar en el formulario de producto. No bloquean el guardado
// salvo los marcados con bloquea:true.
export function revisarFormasVenta(producto) {
  const avisos = []
  const precioUnidad = Number(producto.precioVenta) || 0
  const factores = new Set([1])

  for (const f of producto.formasVenta || []) {
    if (!f.etiqueta?.trim()) {
      avisos.push({ bloquea: true, texto: 'Hay una forma de venta sin nombre.' })
    }
    if (!(Number(f.factor) > 1)) {
      avisos.push({
        bloquea: true,
        texto: `"${f.etiqueta || 'sin nombre'}" tiene que equivaler a mas de 1 unidad.`,
      })
    }
    if (factores.has(Number(f.factor))) {
      avisos.push({
        bloquea: false,
        texto: `Hay dos formas de venta que equivalen a lo mismo (${f.factor}).`,
      })
    }
    factores.add(Number(f.factor))

    if (f.activa !== false) {
      if (!(Number(f.precio) > 0)) {
        avisos.push({ bloquea: true, texto: `Falta el precio de "${f.etiqueta}".` })
      } else if (precioUnidad > 0) {
        const porUnidad = Number(f.precio) / Number(f.factor)
        if (porUnidad > precioUnidad) {
          avisos.push({
            bloquea: false,
            texto: `"${f.etiqueta}" sale mas caro por ${(
              producto.unidadBase || 'unidad'
            ).toLowerCase()} que la venta suelta. Revisa el precio.`,
          })
        }
      }
    }
  }

  return avisos
}
