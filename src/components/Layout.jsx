import { NavLink, Outlet } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Truck,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react'

const SECCIONES = [
  { a: '/', etiqueta: 'Vender', Icono: ShoppingCart, exacto: true },
  { a: '/inventario', etiqueta: 'Inventario', Icono: Package },
  { a: '/compras', etiqueta: 'Compras', Icono: Truck },
  { a: '/caja', etiqueta: 'Caja', Icono: Wallet },
  { a: '/reportes', etiqueta: 'Reportes', Icono: BarChart3 },
  { a: '/configuracion', etiqueta: 'Ajustes', Icono: Settings },
]

export default function Layout() {
  return (
    <div className="min-h-dvh lg:flex">
      {/* Escritorio: barra lateral */}
      <aside className="hidden w-60 shrink-0 border-r border-borde bg-white lg:flex lg:flex-col">
        <div className="border-b border-borde px-5 py-5">
          <p className="text-base font-semibold leading-tight">CreaMed</p>
          <p className="mt-0.5 text-sm text-tinta-suave">Funciona sin internet</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {SECCIONES.map(({ a, etiqueta, Icono, exacto }) => (
            <NavLink
              key={a}
              to={a}
              end={exacto}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-farmacia-claro text-farmacia-oscuro'
                    : 'text-tinta-suave hover:bg-papel hover:text-tinta'
                }`
              }
            >
              <Icono size={19} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido */}
      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      {/* Celular: barra inferior, al alcance del pulgar en el mostrador */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-white area-segura-abajo lg:hidden">
        <div className="grid grid-cols-6">
          {SECCIONES.map(({ a, etiqueta, Icono, exacto }) => (
            <NavLink
              key={a}
              to={a}
              end={exacto}
              className={({ isActive }) =>
                `flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-farmacia' : 'text-tinta-suave'
                }`
              }
            >
              <Icono size={20} />
              <span className="leading-none">{etiqueta}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
