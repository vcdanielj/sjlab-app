# 🏃 Plan de Sprints — SJ Lab Management System

> Cada sprint dura **~1 sesión de trabajo** (2-4 horas).
> Los sprints se ejecutan en orden. No saltar sprints.
> Marcar `[x]` cuando se complete cada tarea.

---

## Sprint 0 — Scaffolding & Infraestructura

**Objetivo:** Proyecto corriendo con Next.js + Cloudflare D1 + Drizzle, con esquema de BD completo y datos semilla.

### Tareas

- [x] Inicializar proyecto Next.js 16 con App Router y TypeScript
- [x] Configurar `@opennextjs/cloudflare` y `wrangler.toml` con binding D1
- [x] Instalar dependencias: `drizzle-orm`, `drizzle-kit`, `wrangler`, `@cloudflare/workers-types`
- [x] Crear `globals.css` con design tokens (colores, tipografía, radios, sombras)
- [x] Importar fuente Inter desde Google Fonts en el root layout
- [x] Crear `src/db/schema.ts` con todas las tablas Drizzle:
  - [x] `users`
  - [x] `workflows`
  - [x] `workflow_steps`
  - [x] `categories`
  - [x] `products`
  - [x] `orders`
  - [x] `order_notes`
  - [x] `order_step_history`
  - [x] `payments`
  - [x] `payment_allocations`
- [x] Configurar `drizzle.config.ts` para D1
- [x] Generar migración inicial (aplicar con `npm run db:migrate` pendiente — requiere crear D1 local)
- [x] Crear `src/db/seed.ts` con datos semilla:
  - [x] 3 flujos de trabajo (Acrílico Convencional, Inyección, Digital Simplificado)
  - [x] Pasos de cada flujo (según PRD sección 10.2)
  - [x] Categorías (Prótesis Totales, PPR Acrílicas, PPR Inyectadas, etc.)
  - [x] 21 productos del catálogo (según PRD sección 11)
  - [x] 1 usuario admin de prueba
  - [x] 2-3 clientes de prueba + 1 técnico
- [x] Crear `src/lib/utils.ts` con helpers: `formatCurrency`, `formatDate`, `generateId`
- [x] Crear `src/lib/constants.ts` con constantes: `ORDER_STATUS`, `PAYMENT_METHODS`, `CURRENCIES`
- [x] Crear `src/types/index.ts` con interfaces de dominio
- [x] Verificar que `npm run dev` inicia sin errores (✅ HTTP 200)
- [ ] Verificar que la base D1 local tiene los datos semilla (requiere `wrangler d1 create` + migrate + seed)

### Criterios de Aceptación

- `npm run dev` arranca sin errores.
- La BD local contiene 3 flujos, sus pasos, categorías y 21 productos.
- El schema Drizzle exporta todas las tablas con relaciones correctas.

---

## Sprint 1 — Autenticación & Layouts Base ✅

**Objetivo:** Login funcional con JWT + PBKDF2, layouts de admin y portal separados, navegación y sidebar.

### Tareas

- [x] Implementar JWT session management (custom, Edge-compatible — Auth.js instalado pero no usado como adapter por incompatibilidad de runtime)
- [x] Implementar hashing de passwords con Web Crypto API (PBKDF2, 100K iteraciones)
- [x] Crear página de Login (`/`)
  - [x] Formulario: email + password
  - [x] Estilo minimalista B&W con logo SJ Lab
  - [x] Redirect post-login: admin → `/dashboard`, cliente → `/portal`
- [x] Crear layout Admin (`src/app/(admin)/layout.tsx`)
  - [x] Sidebar izquierdo con navegación: Dashboard, Pedidos, Clientes, Finanzas, Configuración
  - [x] Footer con nombre del usuario, rol, avatar inicial y botón logout
  - [x] Responsive: sidebar colapsable en tablet, drawer en mobile
- [x] Crear layout Portal (`src/app/(portal)/layout.tsx`)
  - [x] Header limpio con logo, nombre del cliente, clínica y logout
  - [x] Navegación: Mis Pedidos, Mi Cuenta
  - [x] Mobile-first
- [x] Implementar proxy de protección de rutas (`src/proxy.ts`, migrado de middleware — Next.js 16):
  - [x] `/dashboard`, `/orders`, `/clients`, `/finances`, `/settings` → solo admin
  - [x] `/orders` (Kanban) → admin + tech
  - [x] `/portal` → solo client
- [x] Crear componentes UI base:
  - [x] `Button` (primary, secondary, danger, ghost + loading spinner)
  - [x] `Input` (text, number, select, textarea con labels y error)
  - [x] `Modal` (overlay + contenido centrado + Escape + click-outside)
  - [x] `Toast` (provider + hook + auto-dismiss + 4 tipos)
  - [x] `Badge` (success, warning, danger, neutral, primary)
  - [x] `Skeleton` (shimmer + text lines + card presets)
  - [x] `EmptyState` (SVG + título + descripción + action slot)

### Criterios de Aceptación

- ✅ Login page compila y renderiza (HTTP 200)
- ✅ Rutas protegidas redirigen a login sin sesión (307)
- ✅ Sidebar de admin navega entre secciones (páginas placeholder)
- ✅ Portal del cliente tiene header y navegación funcional
- ✅ Todos los componentes UI con CSS Modules sin dependencias externas

---

## Sprint 2 — Módulo de Configuración (Flujos + Catálogo) ✅

**Objetivo:** El admin puede crear, editar y gestionar flujos de trabajo, pasos, categorías y productos.

### Tareas

- [x] **API: Workflows**
  - [x] `GET /api/workflows` — Listar flujos (con sus pasos via relational query)
  - [x] `POST /api/workflows` — Crear flujo + pasos iniciales
  - [x] `PUT /api/workflows/[id]` — Editar nombre, toggle isActive
  - [x] `DELETE /api/workflows/[id]` — Soft-delete (verifica productos activos + órdenes activas)
- [x] **API: Workflow Steps**
  - [x] `POST /api/workflows/[id]/steps` — Agregar paso (auto-append al final)
  - [x] `PUT /api/workflows/[id]/steps/[stepId]` — Editar nombre, toggle active (verifica órdenes)
  - [x] `PATCH /api/workflows/[id]/steps` — Reordenar pasos (batch via array de stepIds)
- [x] **API: Categories**
  - [x] `GET /api/categories` — Listar categorías ordenadas
  - [x] `POST /api/categories` — Crear categoría (auto sort_order)
  - [x] `PUT /api/categories/[id]` — Renombrar
  - [x] `DELETE /api/categories/[id]` — Solo si no tiene productos (409)
- [x] **API: Products**
  - [x] `GET /api/products` — Listar agrupados por categoría (con workflow info)
  - [x] `POST /api/products` — Crear vinculado a flujo + categoría
  - [x] `PUT /api/products/[id]` — Editar (cambio de flujo bloqueado con órdenes activas → 409)
  - [x] `DELETE /api/products/[id]` — Soft-delete (isActive = false)
- [x] **UI: Página Workflows** (`/settings/workflows`)
  - [x] Lista de flujos como cards expandibles
  - [x] Reordenar pasos con ▲/▼ (optimistic update + PATCH API)
  - [x] Modal para crear flujo nuevo (nombre + pasos dinámicos)
  - [x] Inline editing de nombre de paso (doble clic + Enter/Escape)
  - [x] Toggle activar/desactivar paso con validación de órdenes
  - [x] Renombrar flujo, eliminar flujo con confirmación
  - [x] Agregar paso inline al final de la lista
- [x] **UI: Página Catálogo** (`/settings/catalog`)
  - [x] Tabla de productos agrupada por categoría (acordeón expandible)
  - [x] Columnas: Nombre, Detalles, Precio, Flujo Asociado, Estado, Acciones
  - [x] Modal para crear/editar producto (select de categoría y flujo)
  - [x] Modal para crear/renombrar categoría
  - [x] Eliminar categoría (con verificación de productos)
  - [x] Toggle activar/desactivar producto
  - [x] Responsive: oculta columna detalles en mobile

### Criterios de Aceptación

- ✅ Se pueden crear flujos con N pasos y reordenarlos con ▲/▼
- ✅ Se pueden crear productos vinculados a flujos y categorías
- ✅ No se puede borrar un flujo con productos activos (error 409)
- ✅ No se puede cambiar el flujo de un producto con órdenes activas (error 409)
- ✅ Desactivar un paso con órdenes activas retorna error 409

---

## Sprint 3 — Gestión de Clientes ✅

**Objetivo:** CRUD completo de odontólogos/clínicas con directorio filtrable.

### Tareas

- [x] **API: Clients**
  - [x] `GET /api/clients` — Listar con filtros (estado, búsqueda), paginación, y stats calculados (activeOrders, totalInvoiced, totalPaid, balance via subqueries)
  - [x] `GET /api/clients/[id]` — Detalle con resumen financiero, órdenes recientes (con producto/paso), y pagos recientes
  - [x] `POST /api/clients` — Crear cliente (genera contraseña temporal PBKDF2 + mustChangePassword)
  - [x] `PUT /api/clients/[id]` — Editar datos del cliente (nombre, teléfono, clínica, taxId)
  - [x] `PATCH /api/clients/[id]/status` — Activar/desactivar
- [x] **UI: Directorio de Clientes** (`/clients`)
  - [x] Tabla con columnas: Nombre/Clínica, Teléfono, Pedidos Activos, Saldo, Último Pedido, Estado
  - [x] Barra de filtros: búsqueda debounced (400ms) + select de estado (activo/inactivo/todos)
  - [x] Indicador visual de saldo (verde a favor, rojo deuda) con `formatCurrency`
  - [x] Click en fila → navega al detalle
  - [x] Botón "+ Nuevo Cliente"
  - [x] Paginación (anterior/siguiente) con metadata del API
- [x] **UI: Crear Cliente** (`/clients/new`)
  - [x] Formulario 2-columnas: nombre, email, teléfono, clínica, cédula/RIF
  - [x] Validación en cliente (required + email regex) y servidor (email duplicado → 409)
  - [x] Al guardar: vista de éxito con contraseña temporal + botón copiar al portapapeles
  - [x] Botones: "Ir al Directorio" y "Crear Otro"
- [x] **UI: Detalle del Cliente** (`/clients/[id]`)
  - [x] Card de datos personales con avatar, editable inline (grid 2-col)
  - [x] 3 KPI cards: Total Facturado, Total Pagado, Saldo Neto (con colores condicionales)
  - [x] Tabla de pedidos (orderNumber, paciente, producto, paso actual, precio, estado, fecha)
  - [x] Tabla de pagos (fecha, monto, moneda, método, referencia, estado)
  - [x] Toggle activar/desactivar con confirmación
  - [x] Botones placeholder "Registrar Pago" y "Estado de Cuenta PDF" (disabled)

### Criterios de Aceptación

- ✅ Se pueden crear clientes con contraseña temporal (8 chars crypto-random)
- ✅ El directorio filtra por estado y texto libre (nombre, clínica, email)
- ✅ El detalle muestra resumen financiero correcto con 3 KPI cards
- ✅ Balance se calcula como totalPaid - totalInvoiced
- ✅ Todas las rutas protegidas por proxy (307 sin sesión)

---

## Sprint 4 — Gestión de Pedidos + Kanban ✅

**Objetivo:** Crear pedidos y visualizarlos en un tablero Kanban dinámico con filtros y movimiento bidireccional.

### Tareas

- [x] **API: Orders**
  - [x] `GET /api/orders` — Listar con filtros (workflows, cliente, búsqueda, status) + workflows con steps para columnas
  - [x] `GET /api/orders/[id]` — Detalle con historial de pasos (enriquecido), notas y workflow steps
  - [x] `POST /api/orders` — Crear pedido (asigna paso 1, auto order number, registra step history inicial)
  - [x] `PATCH /api/orders/[id]/step` — Mover a cualquier paso (adelante o atrás, registra historial)
  - [x] `PATCH /api/orders/[id]/status` — Cambiar estado (completed/delivered/cancelled, admin-only)
  - [x] `POST /api/orders/[id]/notes` — Agregar nota (admin + técnico)
- [x] **API: Order Step History**
  - [x] Se registra automáticamente al crear pedido y al mover de paso
  - [x] Almacena: fromStepId, toStepId, movedBy, movedAt
  - [x] Se enriquece con nombres de pasos y usuarios via lookup maps
- [x] **UI: Crear Pedido** (`/orders/new`)
  - [x] Select de cliente (lista activos)
  - [x] Select de producto agrupado por categoría (con optgroup)
  - [x] Precio pre-llenado desde suggestedPriceUsd (editable)
  - [x] Campo paciente + notas opcionales (textarea)
  - [x] Toast confirmación + redirect a Kanban
- [x] **UI: Tablero Kanban** (`/orders`)
  - [x] Barra de filtros:
    - [x] Multi-select de flujos con chips de color (toggle)
    - [x] Búsqueda por texto (paciente, odontólogo)
  - [x] Columnas dinámicas según flujos seleccionados
  - [x] Multi-workflow: barra de color en cada tarjeta indicando flujo
  - [x] Tarjeta: orderNumber, paciente, odontólogo, producto, precio, tiempo relativo
  - [x] Botones ←/→ para mover pasos (optimistic update, sin drag & drop externo)
  - [x] Click en tarjeta → Drawer lateral animado con:
    - [x] Info grid (paciente, odontólogo, producto, paso, precio, pagado)
    - [x] Progress bar clickable (mover a cualquier paso)
    - [x] Timeline del historial (quién movió, cuándo, desde/hacia)
    - [x] Notas (agregar nueva inline, ver existentes)
    - [x] Botones: Completar, Entregar, Cancelar (admin)
  - [x] Conteo de tarjetas por columna
  - [x] Card hover animation (shadow + translateY)

### Criterios de Aceptación

- ✅ Se crea un pedido y aparece en la primera columna del Kanban
- ✅ Botones ←/→ mueven la tarjeta al paso adyacente (registra historial)
- ✅ Progress bar en drawer permite mover a cualquier paso (bidireccional)
- ✅ Filtrar por flujo cambia las columnas dinámicamente
- ✅ Multi-flujos muestra barra de color en cada tarjeta
- ✅ Drawer lateral muestra historial completo de movimientos
- ✅ Notas se agregan y visualizan en tiempo real

---

## Sprint 5 — Módulo Financiero (Pagos + FIFO)

**Objetivo:** Registrar pagos en USD y VES, aplicar lógica FIFO, anular pagos, y visualizar cuentas por cobrar.

### Tareas

- [ ] **Implementar `src/lib/fifo.ts`**
  - [ ] Función `applyPayment(clientId, amountUsd)` → crea allocations FIFO
  - [ ] Función `voidPayment(paymentId)` → revierte allocations y recalcula
  - [ ] Transacciones atómicas (D1 batch) para consistencia
- [ ] **API: Payments**
  - [ ] `GET /api/payments?clientId=X` — Historial de pagos del cliente
  - [ ] `POST /api/payments` — Registrar pago (USD o VES con tasa)
  - [ ] `PATCH /api/payments/[id]/void` — Anular pago
  - [ ] `GET /api/payments/[id]/allocations` — Ver distribución FIFO
- [ ] **API: Finances**
  - [ ] `GET /api/finances/summary` — Resumen CxC global (filtrable por rango)
  - [ ] `GET /api/finances/clients` — Tabla de saldos por cliente
- [ ] **UI: Registrar Pago** (`/finances/payment` o modal desde detalle del cliente)
  - [ ] Select de cliente (buscable)
  - [ ] Toggle USD / VES
  - [ ] Si VES: campos de monto VES + tasa + equivalente calculado (readonly)
  - [ ] Si USD: campo de monto USD
  - [ ] Select de método de pago (cambia opciones según moneda)
  - [ ] Campo de referencia (obligatorio para VES)
  - [ ] Fecha del pago (default: hoy)
  - [ ] Preview de distribución FIFO antes de confirmar: tabla que muestra a qué pedidos se aplicará
  - [ ] Botón confirmar con doble confirmación para montos > $100
- [ ] **UI: Vista Financiera** (`/finances`)
  - [ ] Tabla de Cuentas por Cobrar:
    - Columnas: Cliente, Pedidos Activos, Total Facturado, Total Abonado, Saldo Neto, Último Pago
    - Filtros: estado de saldo, rango de fechas, búsqueda, orden
  - [ ] Card resumen superior: Total CxC, Total Saldo a Favor, Cobros del Mes
- [ ] **Integrar con detalle del cliente** (`/clients/[id]`)
  - [ ] Botón "Registrar Pago" ahora funcional (abre modal pre-llenado con cliente)
  - [ ] Tabla de historial de pagos con botón "Anular" y badge de estado
  - [ ] Vista de allocations expandible (ver a qué pedidos se aplicó cada pago)

### Criterios de Aceptación

- Registrar un pago en USD aplica FIFO correctamente (verificar con ejemplo del PRD: $150 sobre $100 + $80).
- Registrar un pago en VES calcula equivalente USD con la tasa ingresada.
- Anular un pago revierte las allocations y restaura los saldos de los pedidos.
- La tasa de cambio queda almacenada en el registro del pago.
- La preview de distribución FIFO es correcta antes de confirmar.
- La tabla CxC muestra saldos reales por cliente.

### Escenarios de Verificación FIFO

| Escenario | Input | Resultado esperado |
|---|---|---|
| Pago cubre 1 pedido | Deuda: P1=$100. Pago: $100 | P1 saldado. Saldo cliente: $0. |
| Pago cubre múltiples | Deuda: P1=$100, P2=$80. Pago: $150 | P1 saldado, P2 queda $30. |
| Saldo a favor | Deuda: P1=$100. Pago: $120 | P1 saldado. Saldo a favor: $20. |
| Saldo a favor se aplica | Favor: $20. Nuevo pedido P3=$60 | P3 queda con $40 de deuda. |
| Anulación simple | Pago de $100 anulado | Se revierte al saldo anterior. |

---

## Sprint 6 — PDF de Estado de Cuenta + Dashboard Analítico

**Objetivo:** Generación de PDFs en el Edge y dashboard con KPIs y gráficas interactivas.

### Tareas

- [ ] **Implementar `src/lib/pdf.ts`**
  - [ ] Generar PDF con jspdf en memoria
  - [ ] Contenido: encabezado (logo + datos cliente), tabla de movimientos (fecha, concepto, cargo, abono, saldo acumulado), pie (saldo neto)
  - [ ] Paginación automática cada 50 filas
  - [ ] Retornar como stream binario (Response con `content-type: application/pdf`)
- [ ] **API: PDF**
  - [ ] `GET /api/clients/[id]/statement` — Genera y retorna PDF del estado de cuenta
  - [ ] Opcional: almacenar en R2 para historial
- [ ] **Integrar PDF en UI**
  - [ ] Botón "Descargar Estado de Cuenta" en `/clients/[id]` (admin)
  - [ ] Botón "Descargar Estado de Cuenta" en `/portal/account` (cliente)
- [ ] **API: Dashboard**
  - [ ] `GET /api/dashboard/kpis?from=X&to=Y` — 4 KPIs + sparklines
  - [ ] `GET /api/dashboard/revenue?from=X&to=Y` — Datos para gráfica ingresos vs facturación
  - [ ] `GET /api/dashboard/production?from=X&to=Y` — Distribución por flujo (dona)
  - [ ] `GET /api/dashboard/completed?from=X&to=Y` — Completados por periodo (línea)
  - [ ] `GET /api/dashboard/top-clients?from=X&to=Y` — Top 5 clientes
  - [ ] `GET /api/dashboard/bottlenecks?workflowId=X` — Tiempo promedio por paso
  - [ ] `GET /api/dashboard/activity` — Últimas 10 acciones
- [ ] **UI: Dashboard** (`/dashboard`)
  - [ ] Selector de periodo (presets + custom con date range)
  - [ ] 4 tarjetas KPI con valor, variación % y sparkline (Recharts)
  - [ ] Gráfica de barras agrupadas: Ingresos vs Facturación (Recharts)
  - [ ] Gráfica de dona: Distribución por flujo (Recharts)
  - [ ] Gráfica de línea: Completados por periodo (Recharts)
  - [ ] Gráfica de barras horizontales: Top 5 clientes (Recharts)
  - [ ] Gráfica de barras horizontales: Cuellos de botella por flujo (Recharts)
  - [ ] Tabla de actividad reciente (últimas 10 acciones)
  - [ ] Responsive: gráficas se apilan en 1 columna en mobile

### Criterios de Aceptación

- PDF se descarga instantáneamente con formato correcto.
- PDF pagina correctamente si hay más de 50 movimientos.
- Dashboard carga con datos reales de la BD.
- El selector de periodo actualiza todas las gráficas.
- Las gráficas muestran tooltips interactivos al hacer hover.
- En mobile las gráficas se leen correctamente (responsive).

---

## Sprint 7 — Portal del Cliente

**Objetivo:** Portal completo para odontólogos con tracking de pedidos y estado de cuenta.

### Tareas

- [ ] **API: Portal**
  - [ ] `GET /api/portal/orders` — Pedidos del cliente autenticado (con progreso de pasos)
  - [ ] `GET /api/portal/account` — Saldo neto + últimos 10 movimientos
- [ ] **UI: Mis Pedidos** (`/portal`)
  - [ ] Lista de pedidos activos con barra de progreso dinámica
  - [ ] Barra de progreso: renderiza los pasos del flujo, resalta el paso actual
  - [ ] Indicador `• Nuevo` si el pedido cambió de paso desde la última visita
  - [ ] Sección de historial (pedidos completados/entregados) colapsable
  - [ ] Filtro: Activo / Completado / Entregado / Todos
- [ ] **UI: Mi Cuenta** (`/portal/account`)
  - [ ] Card de saldo neto con indicador visual (verde/rojo)
  - [ ] Tabla de últimos movimientos con paginación
  - [ ] Botón "Descargar Estado de Cuenta PDF"
- [ ] **UI: Cambio de contraseña**
  - [ ] Flujo de primer login: forzar cambio de contraseña temporal
  - [ ] Opción de cambiar contraseña desde el perfil
- [ ] **Diseño Mobile-First**
  - [ ] Toda la UI del portal optimizada para mobile primero
  - [ ] Touch-friendly: botones grandes, espaciado generoso
  - [ ] Swipe-friendly: lista de pedidos con scroll suave

### Criterios de Aceptación

- El cliente ve sus pedidos con barra de progreso correcta.
- Los nombres de los pasos corresponden a los configurados por el admin.
- El saldo neto coincide con el cálculo FIFO del admin.
- El PDF se descarga correctamente desde el portal.
- El primer login fuerza cambio de contraseña.
- La UI se ve impecable en mobile (iPhone SE como referencia mínima).

---

## Sprint 8 — Pulido, Deploy y QA Final

**Objetivo:** Pulir la experiencia, optimizar queries, y deployar a producción en Cloudflare Pages.

### Tareas

- [ ] **Optimización de queries**
  - [ ] Revisar todas las queries del dashboard: máximo 3 JOINs, uso de índices
  - [ ] Agregar índices en D1 para columnas de filtrado frecuente:
    - `orders.client_id`, `orders.status`, `orders.created_at`
    - `payments.client_id`, `payments.status`
    - `products.workflow_id`, `products.category_id`
  - [ ] Medir tamaño de BD con datos semilla: debe estar bien bajo 5 MB
- [ ] **UX Polish**
  - [ ] Skeleton loaders en todas las páginas con fetch
  - [ ] Empty states con ilustración en todas las vistas vacías
  - [ ] Transiciones suaves entre rutas
  - [ ] Feedback de éxito/error en todas las acciones (toast)
  - [ ] Confirmación antes de acciones destructivas (cancelar pedido, anular pago)
  - [ ] Formateo consistente de moneda ($ con 2 decimales, separador de miles)
  - [ ] Formateo consistente de fechas (dd/mm/yyyy)
- [ ] **Responsiveness**
  - [ ] Verificar cada página en: mobile (375px), tablet (768px), desktop (1280px)
  - [ ] Sidebar colapsable/drawer en tablet/mobile
  - [ ] Kanban scrollable horizontalmente en mobile
- [ ] **Deploy**
  - [ ] Crear base D1 en producción (`wrangler d1 create sjlab-prod`)
  - [ ] Aplicar migraciones a D1 producción
  - [ ] Ejecutar seed en producción
  - [ ] Configurar Cloudflare Pages:
    - Build command: `npx @cloudflare/next-on-pages`
    - Build output: `.vercel/output/static`
    - Bindings: D1 (sjlab-prod), R2 (sjlab-files)
  - [ ] Configurar dominio `sjlabdental.com` en Cloudflare
  - [ ] Deploy y verificar en producción
- [ ] **QA Final — Checklist**
  - [ ] Login admin → dashboard con datos → navegar todos los módulos
  - [ ] Crear flujo → crear producto → crear cliente → crear pedido
  - [ ] Mover pedido en Kanban (adelante y atrás) → verificar historial
  - [ ] Registrar pago USD → verificar FIFO → verificar saldo
  - [ ] Registrar pago VES → verificar tasa → verificar equivalente
  - [ ] Anular pago → verificar reversión de saldo
  - [ ] Descargar PDF de estado de cuenta → verificar contenido
  - [ ] Login como cliente → ver pedidos → ver progreso → descargar PDF
  - [ ] Login como técnico → ver Kanban → mover pedido → agregar nota → NO ver precios

### Criterios de Aceptación

- La aplicación está live en `sjlabdental.com`.
- Todas las funciones del QA checklist pasan.
- El tamaño de la BD en producción está bajo 1 MB con datos semilla.
- El tiempo de respuesta de cada página es < 500ms.
- La UI es coherente y pulida en los 3 breakpoints.

---

## Sprint 9 — Refinamiento Total: UI/UX, Lógica y Funcionalidad

**Objetivo:** Auditoría completa de cada módulo para corregir errores, mejorar la estética, la usabilidad y la funcionalidad. La app debe quedar clase mundial, sin un solo error.

> Este sprint se divide en sub-sprints por módulo. Cada sub-sprint se ejecuta secuencialmente.

---

### 9A — Rediseño del Módulo de Pedidos (Cambio Estructural)

**Cambio principal:** La vista `/orders` deja de ser un Kanban directo. Se convierte en una **lista FIFO** (tabla ordenada por fecha de creación, más antiguo primero). El Kanban se mueve al **detalle** de cada pedido.

- [ ] **Vista Lista de Pedidos (`/orders`)**
  - [ ] Reemplazar el board Kanban por una tabla FIFO con columnas:
    - `#` (orderNumber), Paciente, Odontólogo/Clínica, Producto, Paso Actual, Precio, Pagado, Saldo, Creado, Estado
  - [ ] Ordenación por defecto: fecha de creación ascendente (FIFO — más antiguo arriba)
  - [ ] Permitir ordenar por cualquier columna (click en header)
  - [ ] Filtros superiores:
    - Status tabs: `Activos` | `Completados` | `Entregados` | `Cancelados` | `Todos`
    - Filtro por flujo de trabajo (chips con color)
    - Búsqueda por paciente u odontólogo
  - [ ] En cada fila: botón rápido "Avanzar paso ▶" que mueve al siguiente step sin entrar al detalle
  - [ ] En cada fila: botón rápido "✓ Finalizar" (solo visible si el pedido está en el último paso)
  - [ ] Click en la fila abre el detalle del pedido (drawer o página)
  - [ ] Paginación en la tabla (20 por página)
  - [ ] Badge de color del flujo a la izquierda de cada fila
  - [ ] Indicador visual de tiempo en paso actual (ej: "3d" en gris si < 2 días, amarillo si 2-5, rojo si > 5)

- [ ] **Vista Detalle del Pedido (drawer lateral o `/orders/[id]`)**
  - [ ] Sección superior: Info del pedido (paciente, odontólogo, producto, precio, saldo)
  - [ ] **Mini-Kanban horizontal** mostrando todos los pasos del flujo como stepper visual:
    - Pasos completados en verde con ✓
    - Paso actual resaltado en azul con pulso sutil
    - Pasos pendientes en gris
    - Click en cualquier paso para mover el pedido ahí (con confirmación si retrocede)
  - [ ] Botones de acción claros:
    - "← Paso Anterior" | "Paso Siguiente →" (con nombre del paso destino)
    - "✓ Completar Pedido" (solo si está en último paso)
    - "📦 Marcar como Entregado" (solo si está completado)
    - "✕ Cancelar Pedido" (con diálogo de confirmación)
  - [ ] Sección Historial: timeline vertical con movimientos y quién los hizo
  - [ ] Sección Notas: input + lista de notas con fecha y autor
  - [ ] Sección Financiera: resumen de pagos aplicados a este pedido (FIFO)

### Criterios 9A
- `/orders` muestra tabla FIFO por defecto, no Kanban
- Desde la lista se puede avanzar paso y finalizar sin entrar al detalle
- El detalle muestra el mini-Kanban horizontal clicable
- Todas las transiciones de estado funcionan correctamente
- Rendimiento < 300ms para listar 50 pedidos

---

### 9B — Login y Autenticación

- [ ] **Login Page (`/`)**
  - [ ] Agregar animación de entrada suave (fade-in + slide-up del card)
  - [ ] Mejorar el logo: usar un SVG más elaborado o un icono dental sutil
  - [ ] Agregar efecto de loading en el botón (spinner dentro del botón)
  - [ ] Agregar "show/hide password" toggle (ojo) en el campo de contraseña
  - [ ] Mejorar feedback de error: shake animation en el card + mensaje rojo con icono
  - [ ] Agregar "Recordar sesión" checkbox (extiende el JWT a 30 días)
  - [ ] Footer con versión de la app y año dinámico
  - [ ] Responsive: card centrado en desktop, full-width en mobile

- [ ] **Cambio de contraseña obligatorio**
  - [ ] Si `must_change_password = true`, redirigir a modal de cambio de contraseña al login
  - [ ] Modal con: contraseña actual, nueva contraseña, confirmar nueva contraseña
  - [ ] Validación: mínimo 8 caracteres
  - [ ] Después de cambiar, redirigir al destino normal

- [ ] **Sesión / Seguridad**
  - [ ] Agregar endpoint `/api/auth/change-password`
  - [ ] Después del logout, limpiar completamente el cookie jar
  - [ ] Manejar expiración de JWT con redirect suave (no crash)

### Criterios 9B
- Login con animación fluida y toggle de password
- Cambio de contraseña obligatorio funcional
- Sesión expira limpiamente sin errores

---

### 9C — Sidebar y Navegación

- [ ] **Sidebar (`Sidebar.tsx`)**
  - [ ] Agregar animación de transición al colapsar/expandir (width transition)
  - [ ] Agregar tooltip en modo colapsado (hover sobre icono muestra label)
  - [ ] Agregar indicador de notificaciones en el ícono de Pedidos (badge rojo con conteo de pedidos activos)
  - [ ] Agregar separador visual antes de "Configuración"
  - [ ] Mejorar hover effect: background sutil con border-radius
  - [ ] En mobile: overlay con backdrop-blur + slide-in animation
  - [ ] Footer del sidebar: agregar "v1.0" en texto diminuto
  - [ ] Marcar visualmente la sección activa con borde izquierdo azul (no solo background)

- [ ] **Breadcrumbs**
  - [ ] Agregar breadcrumbs en todas las páginas de detalle:
    - `/clients/[id]` → "Clientes > Dr. Carlos Mendoza"
    - `/orders/new` → "Pedidos > Nuevo Pedido"
    - `/settings/workflows` → "Configuración > Flujos de Trabajo"

### Criterios 9C
- Sidebar con transiciones suaves y tooltips
- Breadcrumbs visibles en todas las sub-páginas
- Mobile sidebar con overlay y animación

---

### 9D — Dashboard Analítico

- [ ] **KPI Cards**
  - [ ] Agregar skeleton loaders durante la carga (4 cards con shimmer)
  - [ ] Animar el número del KPI con un count-up al cargar
  - [ ] Mejorar sparklines: agregar gradiente sutil debajo de la línea
  - [ ] Mostrar tooltip al hover sobre sparkline con valor del día
  - [ ] Si no hay datos, mostrar "--" en vez de "$0.00"

- [ ] **Gráficas**
  - [ ] Ingresos vs Facturación: agregar tooltip personalizado con formato de moneda
  - [ ] Dona de producción: agregar leyenda debajo con porcentajes
  - [ ] Completados: agregar área sombreada de periodo anterior
  - [ ] Top Clientes: mostrar el porcentaje del total junto al nombre
  - [ ] Bottlenecks: cambiar a barras horizontales con gradiente de color (rojo = mucho tiempo)

- [ ] **Actividad Reciente**
  - [ ] Mejorar el timeline: iconos diferentes por tipo (📋 pedido, 💰 pago, ➡ movimiento)
  - [ ] Agregar "Ver más" con lazy loading de items adicionales
  - [ ] Mostrar avatar/inicial del usuario que hizo la acción

- [ ] **Layout General del Dashboard**
  - [ ] Revisar grid responsive: 4 cols en desktop, 2 en tablet, 1 en mobile
  - [ ] Agregar separadores visuales entre secciones
  - [ ] El selector de periodo debe ser sticky al hacer scroll

### Criterios 9D
- Dashboard con skeletons, animaciones de carga, y tooltips completos
- Gráficas con tooltips formateados y leyendas
- Grid responsive perfecto en 3 breakpoints

---

### 9E — Gestión de Clientes

- [ ] **Tabla de Clientes (`/clients`)**
  - [ ] Skeleton loader para la tabla completa
  - [ ] Mejorar las celdas de saldo: chip con color (rojo/verde/gris) más prominente
  - [ ] Agregar avatar con iniciales al lado del nombre del cliente
  - [ ] Agregar columna "Teléfono" con enlace `tel:` clicable
  - [ ] Hover en fila: resaltado sutil + cursor pointer
  - [ ] Agregar "exportar a CSV" (opcional)
  - [ ] Búsqueda con debounce visual (indicador de "buscando...")

- [ ] **Detalle del Cliente (`/clients/[id]`)**
  - [ ] Mejorar el header: card con avatar grande, nombre, clínica, badge de estado
  - [ ] Tabs dentro del detalle: "Información" | "Pedidos" | "Pagos" | "Estado de Cuenta"
  - [ ] Tab Información: formulario de edición inline con botón guardar
  - [ ] Tab Pedidos: tabla paginada de todos los pedidos del cliente
  - [ ] Tab Pagos: timeline de pagos con detalle FIFO
  - [ ] Tab Estado de Cuenta: preview + botón descargar PDF
  - [ ] Botón "Registrar Pago" siempre visible en el header del detalle
  - [ ] Indicador visual de deuda vs saldo a favor prominente

- [ ] **Formulario Nuevo Cliente (`/clients/new`)**
  - [ ] Mejorar la validación en tiempo real:
    - Email: validar formato al perder foco
    - Teléfono: auto-formatear
    - RIF/Cédula: auto-formatear (V-, J-, etc.)
  - [ ] Agregar "Generar contraseña aleatoria" con botón copiar
  - [ ] Mostrar preview de la contraseña generada

### Criterios 9E
- Tabla de clientes con avatares, colores de saldo, y búsqueda fluida
- Detalle del cliente con tabs navegables y toda la info financiera
- Formulario con validación en tiempo real

---

### 9F — Módulo Financiero (Finanzas)

- [ ] **Vista Finanzas (`/finances`)**
  - [ ] Skeleton loaders para las 3 tarjetas summary
  - [ ] Mejorar tarjetas KPI: agregar icono, color de fondo sutil, hover effect
  - [ ] Tabla de cuentas: agregar barra de progreso visual (pagado/facturado) en cada fila
  - [ ] Mejorar filtros: chips tipo "tag" para estado del saldo
  - [ ] Agregar ordenamiento por columna (saldo, nombre, último pago)

- [ ] **Modal de Pago (`PaymentModal.tsx`)**
  - [ ] Agregar tab selector USD/VES más prominente (no radio buttons)
  - [ ] Campo de tasa: agregar "BCV" label informativo
  - [ ] Auto-calcular equivalente USD en tiempo real al escribir monto VES
  - [ ] Agregar preview de cómo se aplicará FIFO antes de confirmar:
    - "Este pago se aplicará: $60 → Pedido #12, $40 → Pedido #15"
  - [ ] Validar que el monto > 0 antes de permitir submit
  - [ ] Agregar loading state al botón de registro
  - [ ] Success: cerrar modal + toast + refresh de datos

- [ ] **Anulación de Pagos**
  - [ ] Agregar diálogo de confirmación con motivo de anulación (opcional)
  - [ ] Mostrar pagos anulados con estilo tachado/opaco en el historial
  - [ ] Badge "ANULADO" en rojo en pagos anulados

### Criterios 9F
- Finanzas con skeletons, barras de progreso, y filtros refinados
- Modal de pago con preview FIFO y auto-cálculo VES
- Anulaciones con confirmación y feedback visual

---

### 9G — Configuración (Flujos + Catálogo)

- [ ] **Flujos de Trabajo (`/settings/workflows`)**
  - [ ] Reemplazar `prompt()` y `confirm()` nativos por modales propios
  - [ ] Agregar drag & drop para reordenar pasos (en lugar de botones ▲▼)
  - [ ] Mejorar la card expandible: animación de expand/collapse
  - [ ] Agregar contador de "pedidos activos" por flujo (ej: "12 pedidos en este flujo")
  - [ ] Agregar tooltip en pasos desactivados: "Este paso no recibirá nuevos pedidos"
  - [ ] Mejorar visual de paso inactivo: tachado + opacidad

- [ ] **Catálogo (`/settings/catalog`)**
  - [ ] Mejorar la UI de categorías: acordeón colapsable por categoría
  - [ ] Mostrar el workflow asociado a cada producto como badge
  - [ ] Agregar indicador de "productos activos" por categoría
  - [ ] Mejorar el formulario de edición de producto: mejor layout
  - [ ] Deshabilitar cambio de workflow si tiene pedidos activos (con tooltip)
  - [ ] Agregar confirmación al eliminar/desactivar producto

- [ ] **Hub de Configuración (`/settings`)**
  - [ ] Agregar más cards: "Usuarios" (gestión de técnicos y admins)
  - [ ] Agregar contadores en cada card (ej: "3 flujos", "21 productos")
  - [ ] Mejorar hover effects con sombra y elevación

### Criterios 9G
- Sin `prompt()` ni `confirm()` nativos — todo con modales custom
- Drag & drop funcional en pasos
- Catálogo con acordeón y badges de workflow

---

### 9H — Portal del Cliente

- [ ] **Mis Pedidos (`/portal`)**
  - [ ] Mejorar la card de pedido: agregar progreso visual con stepper horizontal
  - [ ] Agregar animación de entrada (stagger) al cargar las cards
  - [ ] Mejorar los tabs de filtro: estilo más prominente, con contadores
  - [ ] Mostrar badge con tiempo estimado restante (si procede)
  - [ ] Empty state mejorado: ilustración + mensaje contextual por tab

- [ ] **Mi Cuenta (`/portal/account`)**
  - [ ] Agregar resumen financiero visual: card grande con saldo, gráfico mini de pagos
  - [ ] Historial de pagos con timeline mejorado
  - [ ] Botón "Descargar Estado de Cuenta PDF" prominente
  - [ ] Cambio de contraseña funcional

- [ ] **Layout Portal**
  - [ ] Verificar responsive en mobile (es mobile-first)
  - [ ] Mejorar la barra superior: logo + nombre + menú hamburger
  - [ ] Agregar transiciones entre tabs
  - [ ] Asegurar que precios y saldos son visibles de forma clara

### Criterios 9H
- Portal 100% mobile-first con stepper horizontal
- Cuenta con resumen financiero visual
- PDF descargable y cambio de contraseña funcional

---

### 9I — Componentes UI Globales

- [ ] **Skeleton Loader (`Skeleton.tsx`)**
  - [ ] Mejorar animación: gradiente shimmer más suave
  - [ ] Agregar variantes: SkeletonTable, SkeletonCard, SkeletonKPI

- [ ] **Toast (`Toast.tsx`)**
  - [ ] Agregar iconos por tipo (✓ success, ⚠ warning, ✕ error, ℹ info)
  - [ ] Agregar animación de salida (slide-out)
  - [ ] Agregar botón de dismiss manual

- [ ] **Button (`Button.tsx`)**
  - [ ] Mejorar variante `danger`: hover más oscuro, no genérico
  - [ ] Agregar variante `ghost` (solo texto, sin borde ni fondo)
  - [ ] Agregar variante `icon` (botón cuadrado para acciones de icono)
  - [ ] Mejorar el loading state: spinner alineado

- [ ] **Badge (`Badge.tsx`)**
  - [ ] Agregar variante `outline` (solo borde, sin fondo)
  - [ ] Agregar variante `dot` (punto de color + texto)

- [ ] **Input (`Input.tsx`)**
  - [ ] Agregar estado de error visual (borde rojo + mensaje)
  - [ ] Agregar contador de caracteres (opcional, para textarea)
  - [ ] Mejorar focus ring: blue glow sutil

- [ ] **Modal (`Modal.tsx`)**
  - [ ] Agregar animación de entrada/salida (scale + fade)
  - [ ] Mejorar el backdrop: backdrop-blur
  - [ ] Agregar trap focus para accesibilidad
  - [ ] Cerrar con tecla Escape

- [ ] **EmptyState (`EmptyState.tsx`)**
  - [ ] Agregar icono SVG por contexto (no genérico)
  - [ ] Mejorar tipografía y espaciado

- [ ] **ConfirmDialog**
  - [ ] Agregar variante `warning` (amarillo)
  - [ ] Mejorar animación de entrada

### Criterios 9I
- Todos los componentes con animaciones suaves
- Modales con blur, focus trap, y Escape
- Skeletons específicos por tipo de contenido

---

### 9J — CSS Global y Design System

- [ ] **Design Tokens (`globals.css`)**
  - [ ] Agregar tokens para hover states: `--color-bg-hover`, `--color-row-hover`
  - [ ] Agregar tokens para active states
  - [ ] Agregar `--transition-spring` para animaciones elásticas
  - [ ] Agregar utility class `.truncate` (text-overflow ellipsis)
  - [ ] Agregar utility class `.visually-hidden` mejorado

- [ ] **Consistencia Visual**
  - [ ] Auditar todos los border-radius: unificar a `--radius-md` o `--radius-lg`
  - [ ] Auditar todas las sombras: usar solo los tokens definidos
  - [ ] Auditar todos los font-sizes: usar solo los tokens definidos
  - [ ] Auditar colores hardcoded: reemplazar por tokens CSS

- [ ] **Responsive Global**
  - [ ] Definir breakpoints estándar como custom media queries
  - [ ] Verificar que no haya overflow horizontal en ninguna página a 375px
  - [ ] Asegurar que todas las tablas tienen scroll horizontal en mobile
  - [ ] Verificar touch targets: mínimo 44x44px en mobile

- [ ] **Animaciones**
  - [ ] Definir keyframes globales: `fadeIn`, `slideUp`, `scaleIn`, `shimmer`
  - [ ] Respetar `prefers-reduced-motion` en todas las animaciones
  - [ ] Agregar transiciones a todos los elementos interactivos

### Criterios 9J
- 0 valores de color hardcoded — todo via tokens
- 0 overflow horizontal en mobile (375px)
- Animaciones suaves en toda la app con `prefers-reduced-motion` respetado

---

### 9K — Deploy, Tests y QA Final

- [ ] **Build y Deploy**
  - [ ] Build completo sin warnings ni errores
  - [ ] Deploy a Cloudflare Workers
  - [ ] Verificar todas las rutas en producción

- [ ] **E2E Test Suite** (`tests/e2e-production.sh`)
  - [ ] Agregar tests para las nuevas funcionalidades:
    - Listado FIFO de pedidos
    - Avance rápido de paso desde la lista
    - Cambio de contraseña
    - Nuevos endpoints de workflow GET
  - [ ] Ejecutar suite completa: **0 fallos**

- [ ] **Visual QA — Checklist Manual**
  - [ ] Login → animación de entrada ✓
  - [ ] Dashboard → skeletons → datos → gráficas con tooltips ✓
  - [ ] Pedidos → tabla FIFO → click fila → drawer con mini-Kanban ✓
  - [ ] Avanzar paso desde tabla → confirmar → refresh ✓
  - [ ] Finalizar pedido → confirmar → desaparece de activos ✓
  - [ ] Clientes → tabla con avatares → click → tabs de detalle ✓
  - [ ] Finanzas → KPIs → tabla con barras progreso ✓
  - [ ] Registrar pago → preview FIFO → confirmar → actualización ✓
  - [ ] Settings → workflows sin `prompt()` → drag & drop pasos ✓
  - [ ] Portal → cards con stepper → filtros con contadores ✓
  - [ ] Mobile (375px) → sin overflow → touch targets OK ✓
  - [ ] Sidebar colapsado → tooltips → transición suave ✓

### Criterios Finales 9K
- **0 errores** en consola (ni warnings)
- **0 fallos** en E2E suite
- **0 overflow** horizontal en mobile
- **0 prompt()/confirm()** nativos — todo modales custom
- Toda acción tiene feedback visual (toast o animación)
- Toda carga tiene skeleton o spinner
- Toda navegación tiene transición suave
