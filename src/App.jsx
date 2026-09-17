import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { inicializarBase } from './db/db'
import Vender from './pages/Vender'
import Inventario from './pages/Inventario'
import Compras from './pages/Compras'
import Caja from './pages/Caja'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'

export default function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    inicializarBase()
      .then(() => setListo(true))
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="tarjeta max-w-sm p-5">
          <h1 className="mb-2 text-lg font-semibold">
            No se pudo abrir la base de datos
          </h1>
          <p className="text-sm text-tinta-suave">
            {error} Cierra y vuelve a abrir la aplicacion. Si el problema sigue,
            revisa que el navegador permita guardar datos en este dispositivo.
          </p>
        </div>
      </div>
    )
  }

  if (!listo) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-tinta-suave">Abriendo la farmacia...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Vender />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="compras" element={<Compras />} />
        <Route path="caja" element={<Caja />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}
