# SJ Lab Management System — Development Guide

## Project Overview

SaaS privado para laboratorio dental (SJ Lab). Gestión de producción con Kanban dinámico, finanzas bimonetarias (USD/VES) con cuenta corriente FIFO, y portal de transparencia para odontólogos.

**Dominio:** `sjlabdental.com`
**PRD completo:** `PRD.md` (siempre consultarlo antes de implementar cualquier módulo).

---

## Tech Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) — Edge Runtime obligatorio |
| Hosting | Cloudflare Pages (`@opennextjs/cloudflare`) |
| Base de Datos | Cloudflare D1 (SQLite en el Edge) |
| ORM | Drizzle ORM (adaptador D1) |
| Almacenamiento | Cloudflare R2 (PDFs) |
| Auth | Auth.js (NextAuth v5) + JWT + adaptador D1 |
| UI Components | Componentes propios (no usar shadcn, Radix, ni librerías UI pesadas) |
| Styling | Vanilla CSS (CSS Modules) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Charts | Recharts |
| PDF | jspdf |
| Language | TypeScript estricto (`strict: true`) |

---

## Architecture Rules

### Cloudflare Free Tier — Restricciones Absolutas

Estas restricciones NO son negociables. Todo el código debe respetar estos límites:

- **D1 Storage:** 5 MB máximo. No almacenar blobs, imágenes ni archivos en D1.
- **D1 Reads:** 5M filas/día. Cachear queries del dashboard en el cliente con `stale-while-revalidate`.
- **D1 Writes:** 100K filas/día. Suficiente para operación normal.
- **Worker CPU:** 10ms por invocación. NO hacer JOINs de más de 3 tablas. NO loops anidados sobre resultados SQL.
- **Worker Memory:** 128 MB. Los PDFs deben paginarse a 50 filas máximo.
- **Todas las rutas API** deben declarar `export const runtime = 'edge';`.

### Next.js 15+ Breaking Changes

- **`params` is a Promise:** In route handlers and layouts, `params` must be awaited: `const { id } = await params`.
- **`cookies()` is async:** Must be awaited: `const cookieStore = await cookies()`.
- **`headers()` is async:** Must be awaited: `const headersList = await headers()`.

### Edge Runtime — Lo que NO se puede usar

- `fs` (filesystem)
- `child_process`
- `crypto.createHash` (usar `crypto.subtle`)
- Puppeteer / Playwright
- Cualquier paquete que dependa de Node.js APIs nativas

### Data Access

- **SIEMPRE** usar Drizzle ORM para acceder a D1. Nunca raw SQL inline.
- Las migraciones se gestionan con `drizzle-kit`.
- Los UUIDs se generan con `crypto.randomUUID()` (disponible en Edge).
- Los timestamps se almacenan como `INTEGER` (Unix epoch en segundos).
- Los booleanos se almacenan como `INTEGER` (0 / 1) porque D1/SQLite no tiene tipo boolean.

### Foreign Keys — Política de Borrado

| Relación | Política |
|---|---|
| workflow_steps → workflows | `ON DELETE RESTRICT` |
| products → workflows | `ON DELETE RESTRICT` |
| products → categories | `ON DELETE SET NULL` |
| orders → users (client) | `ON DELETE RESTRICT` |
| orders → products | `ON DELETE RESTRICT` |
| orders → workflow_steps | `ON DELETE RESTRICT` |
| order_notes → orders | `ON DELETE CASCADE` |
| order_step_history → orders | `ON DELETE CASCADE` |
| payments → users (client) | `ON DELETE RESTRICT` |
| payment_allocations → payments | `ON DELETE CASCADE` |
| payment_allocations → orders | `ON DELETE RESTRICT` |

**Regla general:** Nunca borrar físicamente registros con dependencias. Usar `is_active = false` para soft-delete.

---

## Project Structure

```
sjlab-app/
├── CLAUDE.md                    # Este archivo
├── PRD.md                       # Product Requirements Document
├── SPRINTS.md                   # Plan de sprints
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout (fuentes, metadata)
│   │   ├── page.tsx             # Login
│   │   ├── (admin)/             # Route group admin (layout con sidebar)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx     # Kanban
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx     # Directorio
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Detalle + CxC
│   │   │   ├── finances/
│   │   │   │   ├── page.tsx     # Resumen CxC
│   │   │   │   └── payment/
│   │   │   │       └── page.tsx
│   │   │   └── settings/
│   │   │       ├── workflows/
│   │   │       │   └── page.tsx
│   │   │       └── catalog/
│   │   │           └── page.tsx
│   │   ├── (portal)/            # Route group portal (layout limpio)
│   │   │   ├── layout.tsx
│   │   │   └── portal/
│   │   │       ├── page.tsx     # Mis pedidos
│   │   │       └── account/
│   │   │           └── page.tsx # Mi cuenta corriente
│   │   └── api/                 # Route handlers (API endpoints)
│   │       ├── auth/
│   │       ├── orders/
│   │       ├── clients/
│   │       ├── payments/
│   │       ├── workflows/
│   │       ├── products/
│   │       ├── categories/
│   │       └── dashboard/
│   ├── components/              # Componentes reutilizables
│   │   ├── ui/                  # Primitivos UI (Button, Input, Modal, Toast, etc.)
│   │   ├── layout/              # Sidebar, Header, Navigation
│   │   ├── kanban/              # Board, Column, Card, Filters
│   │   ├── dashboard/           # KPICard, Charts (cada gráfica es un componente)
│   │   ├── finances/            # PaymentForm, AccountStatement, AllocationTable
│   │   └── portal/              # ProgressBar, OrderCard
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (todas las tablas)
│   │   ├── index.ts             # DB connection helper
│   │   ├── seed.ts              # Datos semilla (flujos, productos, categorías)
│   │   └── migrations/          # Drizzle-kit migrations
│   ├── lib/
│   │   ├── auth.ts              # Auth.js config
│   │   ├── fifo.ts              # Lógica FIFO de cuenta corriente
│   │   ├── pdf.ts               # Generador de estados de cuenta
│   │   ├── utils.ts             # Helpers generales (formatCurrency, formatDate)
│   │   └── constants.ts         # Constantes (payment methods, order statuses, etc.)
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-toast.ts
│   │   └── use-debounce.ts
│   └── types/                   # TypeScript types/interfaces
│       └── index.ts
├── public/
│   └── logo.svg                 # Logo SJ Lab
├── drizzle.config.ts
├── next.config.ts
├── wrangler.toml                # Cloudflare config (D1 binding, R2 binding)
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## Coding Conventions

### TypeScript

- `strict: true` — sin excepciones.
- No usar `any`. Usar `unknown` y hacer type narrowing.
- Interfaces para objetos de dominio, `type` para uniones y utilidades.
- Exportar types desde `src/types/index.ts`.
- Los enums se definen como `as const` objects, no como `enum` de TS.

```typescript
// ✅ Correcto
export const ORDER_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ❌ Incorrecto
enum OrderStatus { ACTIVE = 'active', ... }
```

### Naming Conventions

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos de componente | PascalCase | `KanbanBoard.tsx` |
| Archivos de utilidad | kebab-case | `fifo.ts`, `use-toast.ts` |
| Archivos CSS Module | kebab-case, mismo nombre que componente | `kanban-board.module.css` |
| Componentes React | PascalCase | `export function KanbanBoard()` |
| Hooks | camelCase con prefijo `use` | `useDebounce` |
| Variables / funciones | camelCase | `calculateFifo()` |
| Constantes | SCREAMING_SNAKE_CASE | `ORDER_STATUS` |
| Tablas DB (Drizzle) | snake_case | `workflow_steps` |
| Columnas DB | snake_case | `current_step_id` |
| API routes | kebab-case | `/api/orders/step-history` |
| CSS custom properties | kebab-case con prefijo `--` | `--color-primary` |

### CSS Modules

- Un archivo `.module.css` por componente.
- NO usar CSS-in-JS, Tailwind, ni estilos inline (excepto valores dinámicos calculados).
- Variables de diseño globales definidas en `src/app/globals.css` como CSS custom properties.
- Mobile-first: escribir estilos base para mobile, luego `@media (min-width: ...)` para desktop.

```css
/* ✅ globals.css — Design tokens */
:root {
  --color-bg: #FFFFFF;
  --color-bg-secondary: #F9F9F9;
  --color-text: #111111;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-primary: #3B82F6;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### Components

- Cada componente en su propio archivo dentro de la carpeta correspondiente.
- Props tipadas con interface nombrada `{ComponentName}Props`.
- NO usar `React.FC`. Usar funciones nombradas con export directo.
- Componentes de servidor por defecto. Agregar `'use client'` solo cuando sea necesario (interactividad, hooks, eventos).

```typescript
// ✅ Correcto
interface KPICardProps {
  title: string;
  value: number;
  trend: number;
  format: 'number' | 'currency' | 'percentage';
}

export function KPICard({ title, value, trend, format }: KPICardProps) {
  return ( ... );
}
```

### API Routes

- Cada endpoint en `src/app/api/{resource}/route.ts`.
- Siempre declarar `export const runtime = 'edge';`.
- Validar inputs manualmente (no instalar Zod para mantener bundle ligero).
- Retornar respuestas consistentes:

```typescript
// ✅ Respuesta de éxito
return Response.json({ data: result }, { status: 200 });

// ✅ Respuesta de error
return Response.json({ error: 'Mensaje descriptivo' }, { status: 400 });
```

### Error Handling

- Envolver operaciones de DB en try/catch.
- Nunca exponer errores internos de D1 al cliente. Loguear con `console.error` y retornar mensaje genérico.
- Usar HTTP status codes semánticamente correctos (400, 404, 409, 500).

---

## FIFO Logic — Reference Implementation

La lógica de cuenta corriente FIFO es la pieza financiera más crítica del sistema. Referencia de implementación en `src/lib/fifo.ts`.

**Algoritmo al registrar un pago:**

1. Obtener todos los pedidos del cliente con `amount_paid_usd < final_price_usd` y `status != 'cancelled'`, ordenados por `created_at ASC`.
2. Iterar sobre los pedidos en orden. Para cada pedido:
   a. Calcular la deuda pendiente: `remaining = final_price_usd - amount_paid_usd`.
   b. Asignar `min(remaining, saldo_disponible)` al pedido.
   c. Crear registro en `payment_allocations`.
   d. Actualizar `amount_paid_usd` en el pedido.
   e. Restar del saldo disponible.
3. Si queda saldo después de cubrir todos los pedidos, registrar como saldo a favor (excedente visible en la vista del cliente).

**Al anular un pago:**
1. Obtener todas las `payment_allocations` del pago.
2. Para cada allocation, restar el `amount_usd` del `amount_paid_usd` del pedido correspondiente.
3. Marcar el pago como `status = 'voided'`.
4. Las allocations se eliminan por CASCADE.

---

## Git Workflow

- **Branch principal:** `main`
- **Feature branches:** `sprint-{N}/{feature-name}` (ej. `sprint-1/db-schema`)
- **Commits:** Conventional Commits en español:
  - `feat: agregar tablero kanban dinámico`
  - `fix: corregir cálculo FIFO con saldo a favor`
  - `refactor: extraer lógica de PDF a lib/pdf`
  - `chore: configurar wrangler.toml con bindings D1`

---

## Commands

```bash
# Development
npm run dev                  # Local dev server (next dev)
npm run build                # Build para Cloudflare Pages
npm run preview              # Preview local del build de Cloudflare

# Database
npm run db:generate          # Generar migraciones con drizzle-kit
npm run db:migrate           # Aplicar migraciones a D1 local
npm run db:migrate:prod      # Aplicar migraciones a D1 producción
npm run db:seed              # Poblar datos semilla
npm run db:studio            # Abrir Drizzle Studio (inspeccionar DB)

# Cloudflare
npx wrangler d1 list         # Listar bases D1
npx wrangler pages deploy    # Deploy a Cloudflare Pages
```

---

## Testing Strategy

- No se usará framework de testing en el MVP para mantener el proyecto ligero.
- **Verificación manual** por sprint con checklist en `SPRINTS.md`.
- Cada sprint define sus criterios de aceptación.
- La lógica FIFO se verifica con escenarios manuales documentados en el sprint correspondiente.

---

## Important Reminders

1. **Siempre consultar `PRD.md`** antes de implementar un módulo para no olvidar reglas de negocio.
2. **Siempre consultar `SPRINTS.md`** para saber qué toca hacer y en qué orden.
3. **No instalar dependencias innecesarias.** El bundle debe ser ultra-ligero para Edge.
4. **No usar `"use client"` a menos que sea obligatorio.** Preferir Server Components.
5. **Cada API route lleva `export const runtime = 'edge'`.** Sin excepción.
6. **Los precios son REAL (float) en D1**, pero se formatean a 2 decimales en la UI con `toFixed(2)`.
7. **No usar librerías de validación** (Zod, Yup). Validar manualmente para minimizar bundle.
