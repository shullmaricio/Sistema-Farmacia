import 'fake-indexeddb/auto'
import { db, inicializarBase } from './src/db/db.js'
import {
  crearProducto,
  validarProducto,
  crearLoteManual,
  restarLoteManual,
  incrementarLote,
  stockDeProducto,
  planFEFO,
  eliminarProductoSiEsPosible,
  resumenPorProducto,
} from './src/db/operaciones.js'

function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg)
  console.log('OK:', msg)
}

await inicializarBase()

// TEST: crear producto valido
const idParacetamol = await crearProducto({
  nombreComercial: 'Paracetamol 500mg',
  principioActivo: 'Paracetamol',
  precioCompra: 1,
  precioVenta: 2,
  stockMinimo: 10,
})
assert(typeof idParacetamol === 'number', 'crea un producto y devuelve id numerico')

// TEST: no permite precio negativo
let fallo = false
try {
  await crearProducto({ nombreComercial: 'Malo', precioVenta: -5 })
} catch (e) {
  fallo = true
}
assert(fallo, 'rechaza precio de venta negativo')

// TEST: no permite nombre vacio
fallo = false
try {
  await crearProducto({ nombreComercial: '  ', precioVenta: 5 })
} catch (e) {
  fallo = true
}
assert(fallo, 'rechaza nombre comercial vacio')

// TEST: codigo de barras duplicado
await crearProducto({ nombreComercial: 'Ibuprofeno', precioVenta: 3, codigoBarras: 'ABC123' })
fallo = false
try {
  await crearProducto({ nombreComercial: 'Otro', precioVenta: 1, codigoBarras: 'ABC123' })
} catch (e) {
  fallo = true
}
assert(fallo, 'rechaza codigo de barras duplicado')

// TEST: crear dos lotes con distinto vencimiento y verificar FEFO
const hoy = new Date()
const en10dias = new Date(hoy.getTime() + 10 * 86400000).toISOString().slice(0, 10)
const en60dias = new Date(hoy.getTime() + 60 * 86400000).toISOString().slice(0, 10)

await crearLoteManual({
  productoId: idParacetamol,
  numeroLote: 'L1-VENCE-PRIMERO',
  fechaVencimiento: en10dias,
  cantidadInicial: 30,
  costoUnitario: 1,
})
await crearLoteManual({
  productoId: idParacetamol,
  numeroLote: 'L2-VENCE-DESPUES',
  fechaVencimiento: en60dias,
  cantidadInicial: 50,
  costoUnitario: 1,
})

let stock = await stockDeProducto(idParacetamol)
assert(stock === 80, `stock total tras 2 lotes es 80 (fue ${stock})`)

const plan = await planFEFO(idParacetamol, 40)
assert(plan.suficiente, 'FEFO: hay stock suficiente para pedir 40')
assert(plan.asignaciones[0].numeroLote === 'L1-VENCE-PRIMERO', 'FEFO: usa primero el lote que vence antes')
assert(
  plan.asignaciones[0].cantidad === 30 && plan.asignaciones[1].cantidad === 10,
  'FEFO: agota el primer lote (30) y completa con 10 del segundo'
)

// TEST: restar mas de lo disponible en un lote debe fallar
const lotes = await db.lotes.where('productoId').equals(idParacetamol).toArray()
const lote1 = lotes.find((l) => l.numeroLote === 'L1-VENCE-PRIMERO')
fallo = false
try {
  await restarLoteManual({
    loteId: lote1.id,
    productoId: idParacetamol,
    cantidad: 999,
    motivo: 'prueba',
  })
} catch (e) {
  fallo = true
}
assert(fallo, 'rechaza restar mas unidades de las que tiene el lote')

// TEST: restar sin motivo debe fallar
fallo = false
try {
  await restarLoteManual({ loteId: lote1.id, productoId: idParacetamol, cantidad: 1, motivo: '' })
} catch (e) {
  fallo = true
}
assert(fallo, 'rechaza un ajuste manual sin motivo')

// TEST: restar con motivo funciona y queda registrado el movimiento
await restarLoteManual({
  loteId: lote1.id,
  productoId: idParacetamol,
  cantidad: 5,
  tipo: 'baja',
  motivo: 'Danado en bodega',
})
stock = await stockDeProducto(idParacetamol)
assert(stock === 75, `stock baja a 75 tras restar 5 (fue ${stock})`)

const movimientos = await db.movimientos.where('productoId').equals(idParacetamol).toArray()
assert(
  movimientos.some((m) => m.tipo === 'baja' && m.cantidad === -5 && m.motivo === 'Danado en bodega'),
  'el movimiento de baja queda registrado con signo negativo y motivo'
)

// TEST: incrementar lote (correccion de conteo)
await incrementarLote({ loteId: lote1.id, productoId: idParacetamol, cantidad: 3, motivo: 'conteo' })
stock = await stockDeProducto(idParacetamol)
assert(stock === 78, `stock sube a 78 tras sumar 3 (fue ${stock})`)

// TEST: el stock resumido por producto coincide con la suma de lotes
const todosLosLotes = await db.lotes.toArray()
const resumen = resumenPorProducto(todosLosLotes)
assert(resumen.get(idParacetamol).stock === 78, 'resumenPorProducto coincide con stockDeProducto')

// TEST: no se puede eliminar fisicamente un producto con lotes/movimientos
fallo = false
try {
  await eliminarProductoSiEsPosible(idParacetamol)
} catch (e) {
  fallo = true
}
assert(fallo, 'no permite eliminar fisicamente un producto que ya tiene lotes')

// TEST: si un producto NO tiene lotes ni movimientos, si se puede eliminar
const idTemporal = await crearProducto({ nombreComercial: 'Producto de prueba', precioVenta: 1 })
await eliminarProductoSiEsPosible(idTemporal)
const buscado = await db.productos.get(idTemporal)
assert(buscado === undefined, 'permite eliminar un producto recien creado sin historial')

console.log('\nTodas las pruebas pasaron correctamente.')
