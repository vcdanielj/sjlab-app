# 📄 Product Requirements Document (PRD)

* **Producto:** SJ Lab Management System
* **Laboratorio:** SJ Lab
* **Dominio:** `sjlabdental.com`
* **Versión:** 3.0 (Producción — Cloudflare Workers)
* **Última actualización:** Mayo 2026

---

## 1. Visión General

SJ Lab Management System es un SaaS privado que digitaliza la operación integral de un laboratorio dental protésico. El sistema abarca cuatro ejes:

1. **Producción:** Flujos de trabajo dinámicos con lista FIFO y stepper Kanban por pedido.
2. **Finanzas:** Cuenta corriente bimonetaria (USD/VES) con lógica FIFO, registro de gastos y KPIs de rentabilidad.
3. **Transparencia:** Portal de consulta para odontólogos con tracking en tiempo real.
4. **Control de Gastos:** Registro de egresos con categorías configurables, soporte bimonetario y gastos recurrentes.

### Principios de Arquitectura

| Principio | Descripción |
|---|---|
| **Edge-First** | Toda la lógica se ejecuta en Cloudflare Workers. Sin servidores tradicionales. |
| **Costo Mínimo** | El sistema opera en la capa gratuita/básica de Cloudflare (D1, Workers, Assets). |
| **Configuración sobre Código** | Flujos de trabajo, pasos, categorías, productos y categorías de gastos son parametrizables por la gerencia sin intervención técnica. |
| **Resilience** | Las operaciones de escritura usan un patrón de fallback: transaction → sequential, para compatibilidad con D1. |

---

## 2. Lineamientos de Diseño (UI/UX)

### 2.1. Filosofía Visual

La plataforma transmite precisión clínica y profesionalismo. El diseño sigue el principio **"Less is More"**: tipografía limpia, abundante espacio en blanco y ausencia total de elementos decorativos superfluos.

### 2.2. Sistema de Color

**Base:** Blanco y Negro.

| Elemento | Color | Hex |
|---|---|---|
| Fondo principal | Blanco puro | `#FFFFFF` |
| Fondo secundario | Gris hielo | `#F9F9F9` |
| Texto primario | Negro profundo | `#111111` |
| Texto secundario | Gris medio | `#6B7280` |
| Bordes y separadores | Gris claro | `#E5E7EB` |

**Acentos Semánticos** (exclusivos para indicadores de estado):

| Estado | Color | Uso |
|---|---|---|
| 🟢 Verde tenue | `#10B981` | Completado / Pagado / Saldo a favor |
| 🟡 Ámbar | `#F59E0B` | En proceso / Pago parcial |
| 🔴 Rojo pálido | `#EF4444` | Deuda / Vencido / Error |
| 🔵 Azul sutil | `#3B82F6` | Botones de acción primaria, enlaces activos |
| 🟣 Índigo | `#6366F1` | Configuración, flujos de trabajo |

### 2.3. Tipografía

* **Familia:** Inter (Google Fonts) — cuerpo y UI.
* **Jerarquía:** Títulos en `600/700` weight, cuerpo en `400`, labels en `500`.

### 2.4. Iconografía

* **SVG inline** en todos los componentes. No se usan librerías de iconos externas.
* Estilo: outline, `strokeWidth="1.5"`, `fill="none"`, dimensiones `20×20` o `24×24`.

### 2.5. Principios de Usabilidad

* **Mobile-First estricto** para el Portal de Clientes.
* **Responsive completo** para el panel de Administración con breakpoints en 1024px, 768px y 480px.
* Reducción drástica de clics: acciones frecuentes accesibles en ≤2 interacciones.
* Feedback visual inmediato en toda operación (toasts, skeleton loaders, estados de transición).
* **No se usan diálogos nativos** (`alert()`, `confirm()`, `prompt()`). Siempre `ConfirmDialog` o `Modal` custom.

---

## 3. Perfiles de Usuario (Roles)

### 3.1. Administrador / Gerencia

Acceso total al sistema. Capacidades:

* Dashboard analítico con 8 KPIs, 5 gráficas interactivas y tabla de actividad reciente.
* Configuración completa: flujos de trabajo, pasos, categorías, productos, usuarios y categorías de gastos.
* Creación y gestión de pedidos (lista FIFO con detalle Kanban por pedido).
* Módulo financiero: registro de pagos bimonetarios, consulta de cuentas corrientes.
* Módulo de gastos: registro, categorización, soporte bimonetario y gastos recurrentes.
* Gestión de clientes (CRUD + generación automática de credenciales de portal).
* Filtrado avanzado y búsqueda tipo combobox con autocompletado.

### 3.2. Técnico de Laboratorio

Acceso operativo limitado. Capacidades:

* Visualizar pedidos y dashboard.
* Agregar notas a pedidos.
* **No puede** ver información financiera, precios, saldos ni datos de gastos.

### 3.3. Cliente (Odontólogo / Clínica)

Acceso restringido al Portal del Cliente (`/portal`). Capacidades:

* Consultar el estatus de sus pedidos activos (barra de progreso por pasos del flujo).
* Visualizar su resumen financiero (total facturado, total abonado, saldo neto).
* Filtrar pedidos por estado: Todos, Activos, Completados, Entregados.
* Gestionar su cuenta (cambiar contraseña, ver datos de perfil).

---

## 4. Gestión de Clientes

### 4.1. Registro y Onboarding

* **El administrador crea las cuentas** de los odontólogos desde el panel (`/clients/new`).
* Datos requeridos: Nombre completo, email.
* Datos opcionales: Teléfono, nombre de clínica/consultorio, cédula/RIF.
* Al crear la cuenta:
  1. Se genera una **contraseña temporal** alfanumérica de 8 caracteres.
  2. Se muestra en pantalla: enlace del portal, contraseña temporal y botón de copiar.
  3. Se ofrece un botón **"Copiar mensaje para el cliente"** que genera un texto preformateado para WhatsApp con el link, email y contraseña.
* El cliente accede al portal y **debe cambiar su contraseña en el primer login** (modal forzado, no cerrable).

### 4.2. Directorio de Clientes

Vista de tabla con columnas:

| Campo | Tipo |
|---|---|
| Nombre / Clínica | Texto |
| Teléfono | Texto |
| Pedidos activos | Conteo |
| Saldo (USD) | Numérico (rojo si deuda, verde si favor) |
| Último pedido | Fecha |
| Estado | Activo / Inactivo |

**Filtros disponibles:**

* Por estado: Activo / Inactivo / Todos.
* Por saldo: Con deuda / Saldo a favor / Sin saldo.
* Búsqueda por nombre, clínica o teléfono.

### 4.3. Creación rápida desde Pedidos

* Al crear un pedido, si el cliente no existe, se puede crear directamente desde el formulario de nuevo pedido.
* La selección de cliente usa un componente `ClientCombobox` con búsqueda en tiempo real.

---

## 5. Módulo de Configuración (Admin)

El módulo de configuración (`/settings`) presenta una interfaz de tarjetas navegables con 4 secciones:

### 5.1. Gestor de Flujos de Trabajo (`/settings/workflows`)

Permite crear, editar y administrar las líneas de producción.

* **Crear flujo:** Nombre + lista ordenada de pasos (Steps).
* **Editar flujo:** Agregar, renombrar, reordenar o desactivar pasos.
* **Desactivar paso:** Los pasos con órdenes activas no se eliminan; se marcan como `is_active = false`.
* **Eliminar flujo:** Solo permitido si no tiene productos vinculados con órdenes activas.

### 5.2. Gestor de Catálogo (`/settings/catalog`)

CRUD de **Categorías** y **Productos/Servicios**.

* Al crear un producto, es obligatorio vincularlo a un flujo de trabajo existente.
* Cada producto tiene un "Precio Sugerido (USD)" que sirve como valor por defecto al crear un pedido.

### 5.3. Gestor de Usuarios (`/settings/users`)

CRUD de usuarios del sistema.

* Crear usuarios con roles: `admin`, `tech`, `client`.
* Activar/desactivar usuarios.
* Resetear contraseña (genera nueva temporal con flag `mustChangePassword`).

### 5.4. Categorías de Gastos (`/settings/expense-categories`)

CRUD de categorías para clasificar los gastos del laboratorio.

* Cada categoría tiene: nombre, color (hex) y estado activo/inactivo.
* Las categorías se usan como filtro y agrupador en el módulo de gastos y en el dashboard.

---

## 6. Gestión de Pedidos (Orders)

### 6.1. Vista Principal: Lista FIFO (`/orders`)

Los pedidos se listan en **orden FIFO** (más recientes primero) en una tabla, no directamente en Kanban.

**Barra de filtros superior:**

| Filtro | Tipo |
|---|---|
| Estado | Tabs: Todos / Activos / Completados / Entregados / Cancelados |
| Búsqueda | Combobox con autocompletado por cliente o paciente |
| Flujo de trabajo | Chips seleccionables (multi-select) con botón "Limpiar" |

**Columnas de la tabla:**

| Columna | Descripción |
|---|---|
| # | Número de pedido secuencial |
| Cliente | Nombre del odontólogo |
| Paciente | Nombre del paciente |
| Producto | Nombre del producto/servicio |
| Paso actual | Paso del flujo en el que se encuentra |
| Precio | Precio final en USD |
| Estado | Badge con color semántico |
| Tiempo | Tiempo relativo desde creación |

### 6.2. Creación de Pedido (`/orders/new`)

Campos del formulario:

| Campo | Tipo | Regla |
|---|---|---|
| Cliente (Odontólogo) | `ClientCombobox` (buscable con autocompletado) | Obligatorio |
| Paciente | Texto libre | **Opcional** |
| Producto / Servicio | Select (agrupado por categoría) | Obligatorio |
| Precio Final (USD) | Numérico (pre-llenado con precio sugerido) | Editable por el admin |
| Notas | Textarea | Opcional |

Al guardar, el pedido se crea en el **primer paso** del flujo de trabajo asociado al producto, con estado `active`. Si el cliente tiene saldo a favor, se aplica automáticamente mediante FIFO.

### 6.3. Detalle del Pedido (Drawer lateral)

Al hacer clic en un pedido, se abre un drawer lateral con:

* **Mini-Kanban Stepper:** Visualización horizontal de todos los pasos del flujo con indicador del paso actual.
* **Botones de acción:** Avanzar al siguiente paso, marcar como Completado, Entregado o Cancelado.
* **Información completa:** Cliente, paciente, producto, precio, monto pagado, saldo pendiente.
* **Historial de movimientos:** Registro cronológico de cada cambio de paso con usuario y timestamp.
* **Notas:** Lista de notas con formulario para agregar nuevas.

### 6.4. Ciclo de Vida del Pedido

```
Creado (Paso 1) → [Avanza por pasos del flujo] → Último paso → Completado → Entregado
                                                                     ↓
                                                                 Cancelado
```

| Estado | Descripción | Transiciones permitidas |
|---|---|---|
| `active` | El pedido está en tránsito dentro del flujo de producción. | → siguiente paso, ← paso anterior |
| `completed` | El pedido alcanzó el último paso del flujo Y el admin lo marcó como completado. | → `delivered`, → `cancelled` |
| `delivered` | El pedido fue entregado físicamente al odontólogo. **Estado terminal.** | Ninguna |
| `cancelled` | El pedido fue cancelado. Los abonos previos permanecen como saldo a favor. | Ninguna |

**Reglas de transición:**
* Completar un pedido requiere acción explícita del administrador.
* Cancelar un pedido no borra los pagos asociados. El saldo pagado queda como crédito a favor.
* Los cambios de estado se pueden ejecutar desde el drawer de detalle del pedido.

---

## 7. Módulo Financiero

### 7.1. Moneda y Tasa de Cambio

* **Moneda base:** Dólar Estadounidense (USD). Toda la contabilidad se consolida en USD.
* **Tasa de cambio:** Siempre manual. El administrador ingresa la tasa vigente al registrar cada pago en bolívares.
* **Registro histórico:** Cada transacción en VES almacena la tasa utilizada.

### 7.2. Registro de Pagos (`/finances`)

Al registrar un abono, el formulario solicita:

| Campo | Moneda USD | Moneda VES |
|---|---|---|
| Monto | Monto en USD | Monto bruto en VES |
| Tasa de cambio | — | Obligatorio (numérico decimal) |
| Equivalente USD | = Monto | = Monto VES / Tasa (calculado automáticamente) |
| Método de pago | Efectivo, Zelle, Transferencia | Transferencia, Pago Móvil |
| Referencia | Opcional | Obligatorio |
| Fecha del pago | Fecha (default: hoy) | Fecha (default: hoy) |

### 7.3. Lógica de Cuenta Corriente (FIFO)

Los pagos impactan el **saldo global** del cliente, no un pedido individual.

**Método FIFO (First In, First Out) por fecha de creación del pedido:**

1. Al registrar un abono, el sistema obtiene la lista de pedidos del cliente con saldo pendiente, ordenados por fecha de creación ascendente.
2. El abono se aplica al pedido más antiguo hasta cubrirlo.
3. Si queda remanente, se aplica al siguiente pedido pendiente.
4. Si el abono excede la deuda total, el excedente queda como **saldo a favor** (crédito).
5. El saldo a favor se aplica automáticamente a futuros pedidos al momento de su creación.

### 7.4. Anulación de Pagos

* El administrador puede anular un pago registrado por error (`/api/payments/[id]/void`).
* La anulación **revierte** el impacto FIFO: recalcula los saldos de todos los pedidos afectados.
* El pago anulado queda visible en el historial marcado como `voided`.

### 7.5. Vista Financiera del Admin (`/finances`)

**Tabla de Cuentas por Cobrar:**

| Columna | Descripción |
|---|---|
| Cliente | Nombre del odontólogo/clínica |
| Pedidos activos | Cantidad |
| Total facturado (USD) | Suma de precios de todos los pedidos |
| Total abonado (USD) | Suma de todos los pagos |
| Saldo neto | Diferencia (rojo si deuda, verde si favor) |
| Último pago | Fecha |

---

## 8. Módulo de Gastos (`/expenses`)

### 8.1. Registro de Gastos

El módulo permite registrar egresos del laboratorio con soporte completo bimonetario.

**Campos del formulario:**

| Campo | Tipo | Regla |
|---|---|---|
| Descripción | Texto | Obligatorio |
| Categoría | Select (categorías configurables) | Obligatorio |
| Moneda | USD / VES | Obligatorio |
| Monto | Numérico | Obligatorio |
| Tasa de cambio | Numérico | Solo para VES (obligatorio) |
| Fecha del gasto | Fecha | Default: hoy |
| Notas | Textarea | Opcional |
| ¿Es recurrente? | Toggle | Default: No |

### 8.2. Gastos Recurrentes

Si se marca como recurrente:

| Campo | Tipo |
|---|---|
| Intervalo | Semanal / Quincenal / Mensual / Trimestral / Anual |
| Template | Seleccionar un gasto recurrente existente como base |

Los gastos recurrentes se identifican con un badge visual y se pueden usar como plantilla para registrar nuevas instancias rápidamente.

### 8.3. Categorías de Gastos

Configurables desde `/settings/expense-categories`:

* Cada categoría tiene nombre, color (hex) y estado activo/inactivo.
* Se usan para filtrar, agrupar y colorear gastos en la vista principal y el dashboard.

### 8.4. Vista de Gastos

* Lista paginada de gastos con filtros por categoría, rango de fechas y moneda.
* Resumen superior con total de gastos del periodo seleccionado.
* Indicadores visuales por categoría (color badges).

---

## 9. Dashboard Analítico (`/dashboard`)

El dashboard es la primera vista al iniciar sesión como Administrador. Presenta KPIs de alto nivel y gráficas interactivas.

### 9.1. Selector de Periodo

Barra superior con selector de rango temporal que afecta todas las métricas y gráficas:

* **Presets:** Hoy, Esta Semana, Este Mes (default), Último Trimestre, Este Año.

### 9.2. Tarjetas KPI (8 métricas)

Cada tarjeta muestra el dato principal, variación porcentual vs. periodo anterior, y un sparkline miniatura.

| KPI | Cálculo |
|---|---|
| **Total Facturado** | `SUM(orders.final_price_usd)` en el periodo |
| **Total Cobrado** | `SUM(payments.amount_usd)` en el periodo, excluyendo voided |
| **Nuevos Pedidos** | `COUNT(orders)` creados en el periodo |
| **Pedidos Completados** | `COUNT(orders WHERE status IN ('completed', 'delivered'))` en el periodo |
| **Total Gastos** | `SUM(expenses.amount_usd)` en el periodo |
| **Margen Neto** | Cobrado - Gastos del periodo |
| **Tasa de Cobranza** | (Cobrado / Facturado) × 100 |
| **Clientes Activos** | Clientes con al menos 1 pedido activo |

### 9.3. Gráficas (5)

#### 9.3.1. Ingresos vs. Facturación (Barras Agrupadas)
* **Barras:** Total facturado (azul) vs. Total cobrado (verde) por periodo.
* **Librería:** Recharts `BarChart`.

#### 9.3.2. Distribución de Producción por Flujo (Dona)
* Cada segmento representa un flujo de trabajo.
* **Centro:** Total de pedidos activos.
* **Librería:** Recharts `PieChart`.

#### 9.3.3. Facturación vs. Gastos (Composed Chart)
* **Barras:** Facturación por periodo.
* **Línea:** Gastos por periodo.
* **Propósito:** Visualizar rentabilidad y tendencias de costos.

#### 9.3.4. Top 5 Clientes por Facturación (Barras Horizontales)
* Los 5 odontólogos con mayor facturación en el periodo.
* **Librería:** Recharts `BarChart` layout vertical.

#### 9.3.5. Cuellos de Botella en Producción (Barras Horizontales)
* Tiempo promedio (horas) que los pedidos permanecen en cada paso del flujo.
* Los pasos con mayor tiempo se resaltan.

### 9.4. Actividad Reciente (Tabla inferior)

Tabla de las últimas acciones del sistema:

| Columna | Ejemplo |
|---|---|
| Hora | 14:32 |
| Acción | Pedido #127 movido a "Enfilado" |
| Usuario | Técnico: Juan P. |

---

## 10. Portal del Cliente

### 10.1. Acceso

* **URL:** `{domain}/` (login unificado, redirige a `/portal` para clientes)
* **Autenticación:** Email + contraseña temporal (primer login fuerza cambio).
* **Diseño:** Mobile-First. Interfaz limpia, sin elementos administrativos.

### 10.2. Flujo de Primer Acceso

1. El administrador crea la cuenta del cliente y obtiene la contraseña temporal.
2. El administrador envía al cliente: enlace, email y contraseña (via botón "Copiar mensaje para WhatsApp").
3. El cliente ingresa con sus credenciales temporales.
4. Se muestra un **modal forzado de cambio de contraseña** (no cerrable).
5. Tras cambiar la contraseña, accede al portal normalmente.

### 10.3. Vista de Pedidos (`/portal`)

* Resumen financiero: Total Facturado, Total Abonado, Saldo (a favor o pendiente).
* Lista de pedidos activos con barra de progreso dinámica por pasos del flujo.
* Sección colapsable de historial (pedidos completados/entregados).
* Filtros: Todos / Activos / Completados / Entregados.

### 10.4. Mi Cuenta (`/portal/account`)

* Datos del perfil (nombre, email, clínica, teléfono).
* Botón de cambio de contraseña (abre modal).
* Botón de logout.

### 10.5. Navegación del Portal

Header con: logo SJ Lab, nombre del usuario, clínica, navegación (Mis Pedidos / Mi Cuenta), botón 🔑 cambiar contraseña, botón Salir.

---

## 11. Arquitectura del Motor de Flujos

### 11.1. Modelo de Datos Relacional

```
[Flujo de Trabajo (Workflow)]
       │
       ├──► [Pasos del Flujo (Workflow Steps)]
       │       → Define las etapas de producción
       │       → Ordenados por sort_order (integer)
       │       → Campo is_active (boolean)
       │
       └──► [Producto / Servicio]
                → Vinculado a exactamente 1 flujo
                │
                └──► [Pedido / Orden]
                        → Guarda current_step_id (paso actual)
                        → Estado: active | completed | delivered | cancelled
```

### 11.2. Flujos Preconfigurados (Datos Semilla)

El sistema se inicializa con tres flujos base:

**1. Flujo Acrílico Convencional (8 pasos):**

| # | Paso |
|---|---|
| 1 | Preparación de modelo |
| 2 | Cubetas individuales |
| 3 | Placa base con rodetes |
| 4 | Montaje de articulador |
| 5 | Enfilado |
| 6 | Enmuflado |
| 7 | Acrilizado |
| 8 | Tallado y pulido |

**2. Flujo de Inyección (8 pasos):**

| # | Paso |
|---|---|
| 1 | Preparación de modelo |
| 2 | Cubetas individuales |
| 3 | Placa base con rodetes |
| 4 | Montaje de articulador |
| 5 | Enfilado |
| 6 | Enmuflado |
| 7 | Inyección |
| 8 | Tallado y pulido |

**3. Flujo Digital Simplificado (4 pasos):**

| # | Paso |
|---|---|
| 1 | Recepción de archivo / Escaneo |
| 2 | Diseño digital (CAD) |
| 3 | Impresión / Fabricación |
| 4 | Acabado y control de calidad |

---

## 12. Catálogo de Servicios Base

Datos iniciales de la base de datos. El administrador puede alterar precios, nombres, categorías y flujos.

| Categoría | Producto / Servicio | Detalles | Precio Sugerido (USD) | Flujo Asociado |
|---|---|---|---|---|
| **Prótesis Totales** | Prótesis Total Acrílica | A partir de 9 UD (Inc. cubeta e/rodetes) | $100.00 | Acrílico Convencional |
| **Prótesis Totales** | Totales Acrílicas Caracterizadas | — | $120.00 | Acrílico Convencional |
| **Prótesis Totales** | Prótesis Total Inyectada | — | $120.00 | Inyección |
| **PPR Acrílicas** | PPR Acrílica (1–3 UD) | 1 a 3 Unidades Dentales | $50.00 | Acrílico Convencional |
| **PPR Acrílicas** | PPR Acrílica (4–6 UD) | 4 a 6 Unidades Dentales | $60.00 | Acrílico Convencional |
| **PPR Acrílicas** | PPR Acrílica (7–8 UD) | 7 a 8 Unidades Dentales | $70.00 | Acrílico Convencional |
| **PPR Inyectadas** | Acrílico Inyectado (1–3 UD) | 1 a 3 Unidades Dentales | $80.00 | Inyección |
| **PPR Inyectadas** | Acrílico Inyectado (4–6 UD) | 4 a 6 Unidades Dentales | $90.00 | Inyección |
| **PPR Inyectadas** | Acrílico Inyectado (7–8 UD) | 7 a 8 Unidades Dentales | $100.00 | Inyección |
| **PPR Valplast** | Prótesis Valplast (1–3 UD) | 1 a 3 Unidades Dentales | $80.00 | Inyección |
| **PPR Valplast** | Prótesis Valplast (4–6 UD) | 4 a 6 Unidades Dentales | $90.00 | Inyección |
| **PPR Valplast** | Prótesis Valplast (7–8 UD) | 7 a 8 Unidades Dentales | $100.00 | Inyección |
| **Férulas** | Férula para Bruxismo (Termo) | — | $45.00 | Acrílico Convencional |
| **Férulas** | Férula de Acetato | Precio unitario (c/u) | $20.00 | Acrílico Convencional |
| **Férulas** | Férula de Acetato Híbrida | — | $30.00 | Acrílico Convencional |
| **Estética / Fija** | Provisionales | Precio unitario | $15.00 | Acrílico Convencional |
| **Estética / Fija** | Incrustaciones en Ceramage | — | $40.00 | Acrílico Convencional |
| **Estética / Fija** | Coronas en Ceramage | — | $45.00 | Acrílico Convencional |
| **Flujo Digital** | Encerado Diagnóstico Digital | Precio por cada UD | $10.00 | Digital Simplificado |
| **Flujo Digital** | Escaneo Intraoral | — | $40.00 | Digital Simplificado |
| **Flujo Digital** | Impresión de Modelos 3D | Articulado | $15.00 | Digital Simplificado |

---

## 13. Stack Tecnológico

| Capa | Tecnología | Notas |
|---|---|---|
| **Runtime** | Cloudflare Workers | Via `opennextjs-cloudflare` adapter |
| **Framework** | Next.js (App Router) | Edge Runtime, server components + client components |
| **Base de Datos** | Cloudflare D1 (SQLite Edge) | Base `sjlab-prod` |
| **ORM** | Drizzle ORM (adaptador D1) | Schema-first, migraciones con `drizzle-kit` |
| **Assets** | Cloudflare Workers Assets | Archivos estáticos servidos desde `.open-next/assets` |
| **Gráficas** | Recharts | `ResponsiveContainer` con `minWidth={0}` para estabilidad |
| **Autenticación** | Custom JWT + PBKDF2 | Edge-compatible, Web Crypto API, 100K iteraciones |
| **Session** | Cookie `sjlab-session` | JWT firmado con HMAC-SHA256 |
| **Routing Protection** | `middleware.ts` (Edge Runtime) | Role-based access control |
| **Build** | `opennextjs-cloudflare` | Compila Next.js a Worker-compatible bundle |
| **Deploy** | `wrangler deploy` | Versionado automático por Cloudflare |

### Patrón de Resiliencia: Transaction Fallback

Cloudflare D1 con Drizzle ORM puede fallar en `db.transaction()`. Todas las operaciones de escritura multi-paso usan:

```typescript
try {
  await db.transaction(async (tx) => { /* ... */ });
} catch (txError) {
  console.error('Transaction failed, falling back:', txError);
  // Ejecutar operaciones secuencialmente sin transacción
  await db.insert(/* ... */);
}
```

### Observabilidad

```toml
[observability]
enabled = true
head_sampling_rate = 1

[observability.logs]
enabled = true
head_sampling_rate = 1
invocation_logs = true
```

---

## 14. Esquema de Base de Datos (Drizzle ORM)

### 14.1. Diagrama de Entidades

```
users
  ├──► orders (client_id)
  ├──► payments (client_id)
  ├──► order_notes (user_id)
  ├──► order_step_history (moved_by)
  └──► expenses (created_by)

workflows
  ├──► workflow_steps (workflow_id)
  └──► products (workflow_id)

categories
  └──► products (category_id)

products
  └──► orders (product_id)

workflow_steps
  └──► orders (current_step_id)

orders
  ├──► order_notes (order_id)
  ├──► order_step_history (order_id)
  └──► payment_allocations (order_id)

payments
  └──► payment_allocations (payment_id)

expense_categories
  └──► expenses (category_id)
```

### 14.2. Tablas

#### `users`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | ID generado |
| name | TEXT NOT NULL | |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | PBKDF2 hash |
| phone | TEXT | |
| clinic_name | TEXT | Nombre de la clínica (opcional) |
| tax_id | TEXT | Cédula / RIF |
| role | TEXT NOT NULL | `admin` \| `tech` \| `client` |
| is_active | INTEGER (bool) | Default 1 |
| must_change_password | INTEGER (bool) | Default 0. True para clientes nuevos |
| created_at | INTEGER | Unix timestamp |

#### `workflows`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| name | TEXT NOT NULL | |
| is_active | INTEGER (bool) | Default 1 |
| created_at | INTEGER | |

#### `workflow_steps`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| workflow_id | TEXT FK → workflows | ON DELETE RESTRICT |
| name | TEXT NOT NULL | |
| sort_order | INTEGER NOT NULL | Posición en el flujo (1, 2, 3...) |
| is_active | INTEGER (bool) | Default 1 |

#### `categories`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| name | TEXT NOT NULL | |
| sort_order | INTEGER | Para ordenar en el selector |

#### `products`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| category_id | TEXT FK → categories | ON DELETE SET NULL |
| workflow_id | TEXT FK → workflows | ON DELETE RESTRICT |
| name | TEXT NOT NULL | |
| details | TEXT | Descripción o notas |
| suggested_price_usd | REAL NOT NULL | Precio sugerido en USD |
| is_active | INTEGER (bool) | Default 1 |
| created_at | INTEGER | |

#### `orders`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| order_number | INTEGER NOT NULL | Número secuencial (MAX+1) |
| client_id | TEXT FK → users | ON DELETE RESTRICT |
| product_id | TEXT FK → products | ON DELETE RESTRICT |
| current_step_id | TEXT FK → workflow_steps | ON DELETE RESTRICT |
| patient_name | TEXT NOT NULL | Puede ser vacío ('') |
| final_price_usd | REAL NOT NULL | Precio final acordado |
| amount_paid_usd | REAL DEFAULT 0 | Monto pagado vía FIFO |
| status | TEXT NOT NULL | `active` \| `completed` \| `delivered` \| `cancelled` |
| notes | TEXT | Notas del admin al crear |
| created_at | INTEGER | |
| completed_at | INTEGER | Nullable |
| delivered_at | INTEGER | Nullable |

#### `order_notes`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| order_id | TEXT FK → orders | ON DELETE CASCADE |
| user_id | TEXT FK → users | Quién escribió la nota |
| content | TEXT NOT NULL | |
| created_at | INTEGER | |

#### `order_step_history`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| order_id | TEXT FK → orders | ON DELETE CASCADE |
| from_step_id | TEXT FK → workflow_steps | Nullable (null si es el primer paso) |
| to_step_id | TEXT FK → workflow_steps | |
| moved_by | TEXT FK → users | |
| moved_at | INTEGER | |

#### `payments`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| client_id | TEXT FK → users | ON DELETE RESTRICT |
| currency | TEXT NOT NULL | `USD` \| `VES` |
| amount | REAL NOT NULL | Monto en la moneda original |
| exchange_rate | REAL | Solo para VES |
| amount_usd | REAL NOT NULL | Equivalente en USD |
| payment_method | TEXT NOT NULL | Efectivo, Zelle, Transferencia, Pago Móvil |
| reference | TEXT | Referencia alfanumérica |
| payment_date | INTEGER | Fecha del pago |
| status | TEXT NOT NULL | `active` \| `voided` |
| voided_at | INTEGER | Nullable |
| created_at | INTEGER | |

#### `payment_allocations`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| payment_id | TEXT FK → payments | ON DELETE CASCADE |
| order_id | TEXT FK → orders | ON DELETE RESTRICT |
| amount_usd | REAL NOT NULL | Monto asignado a este pedido |
| created_at | INTEGER | |

> Esta tabla implementa la distribución FIFO. Cada pago puede tener múltiples allocations.

#### `expense_categories`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| name | TEXT NOT NULL | |
| color | TEXT NOT NULL | Hex color. Default `#6B7280` |
| sort_order | INTEGER | Default 0 |
| is_active | INTEGER (bool) | Default 1 |

#### `expenses`

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | |
| description | TEXT NOT NULL | |
| category | TEXT NOT NULL | Tipo legacy: `material` \| `equipo` \| `servicios` \| `nomina` \| `otro` |
| category_id | TEXT FK → expense_categories | Nullable, referencia a categoría configurable |
| currency | TEXT NOT NULL | Default 'USD' |
| amount_original | REAL | Monto en moneda original (para VES) |
| exchange_rate | REAL | Tasa para VES |
| amount_usd | REAL NOT NULL | Equivalente en USD |
| expense_date | INTEGER NOT NULL | Fecha del gasto |
| notes | TEXT | |
| is_recurring | INTEGER (bool) | Default 0 |
| recurrence_interval | TEXT | `weekly` \| `biweekly` \| `monthly` \| `quarterly` \| `yearly` |
| recurrence_template_id | TEXT | ID del gasto que sirve como plantilla |
| created_by | TEXT FK → users | ON DELETE RESTRICT |
| created_at | INTEGER | |

---

## 15. Mapa de Navegación

```
/ (Login — unificado para todos los roles)
│
├── /dashboard .............. Dashboard: 8 KPIs + 5 Gráficas + Actividad (Admin)
│
├── /orders
│   ├── /orders ............. Lista FIFO + Drawer detalle con Mini-Kanban (Admin)
│   └── /orders/new ......... Crear pedido con ClientCombobox (Admin)
│
├── /clients
│   ├── /clients ............ Directorio de clientes (Admin)
│   ├── /clients/new ........ Crear cliente + credenciales portal (Admin)
│   └── /clients/[id] ....... Detalle del cliente + cuenta corriente (Admin)
│
├── /finances ............... Resumen CxC + registro de pagos (Admin)
│
├── /expenses ............... Registro de gastos + gastos recurrentes (Admin)
│
├── /settings
│   ├── /settings ........... Hub de configuración (4 tarjetas) (Admin)
│   ├── /settings/workflows . Gestor de flujos y pasos (Admin)
│   ├── /settings/catalog ... Gestor de categorías y productos (Admin)
│   ├── /settings/users ..... Gestor de usuarios y roles (Admin)
│   └── /settings/expense-categories . Categorías de gastos (Admin)
│
└── /portal
    ├── /portal ............. Mis pedidos + tracking + resumen financiero (Cliente)
    └── /portal/account ..... Mi cuenta + cambiar contraseña (Cliente)
```

---

## 16. APIs

### 16.1. Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con email/password, devuelve JWT + redirect |
| POST | `/api/auth/logout` | Elimina cookie de sesión |
| POST | `/api/auth/change-password` | Cambio de contraseña (verifica actual, refresca sesión) |

### 16.2. Pedidos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/orders` | Lista pedidos con filtros (status, workflow, search, clientId) |
| POST | `/api/orders` | Crear pedido (con auto-asignación FIFO de créditos) |
| GET | `/api/orders/[id]` | Detalle de un pedido |
| PATCH | `/api/orders/[id]` | Actualizar pedido |
| PATCH | `/api/orders/[id]/step` | Mover pedido a otro paso del flujo |
| PATCH | `/api/orders/[id]/status` | Cambiar estado (completed, delivered, cancelled) |
| GET | `/api/orders/[id]/notes` | Notas de un pedido |
| POST | `/api/orders/[id]/notes` | Agregar nota a un pedido |

### 16.3. Clientes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/clients` | Lista de clientes con saldos |
| POST | `/api/clients` | Crear cliente (genera password temporal) |
| GET | `/api/clients/[id]` | Detalle de cliente |
| PATCH | `/api/clients/[id]` | Actualizar cliente |
| PATCH | `/api/clients/[id]/status` | Activar/desactivar cliente |

### 16.4. Pagos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/payments?clientId=X` | Historial de pagos de un cliente |
| POST | `/api/payments` | Registrar pago (con distribución FIFO) |
| PATCH | `/api/payments/[id]/void` | Anular pago (revierte FIFO) |

### 16.5. Gastos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/expenses` | Lista paginada de gastos con filtros |
| POST | `/api/expenses` | Registrar gasto |
| DELETE | `/api/expenses/[id]` | Eliminar gasto |

### 16.6. Configuración

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/api/workflows` | CRUD flujos de trabajo |
| GET/PATCH/DELETE | `/api/workflows/[id]` | Detalle/editar/eliminar flujo |
| GET/POST | `/api/workflows/[id]/steps` | CRUD pasos de un flujo |
| PATCH/DELETE | `/api/workflows/[id]/steps/[stepId]` | Editar/eliminar paso |
| GET/POST | `/api/categories` | CRUD categorías de productos |
| GET/PATCH/DELETE | `/api/categories/[id]` | Detalle/editar/eliminar categoría |
| GET/POST | `/api/products` | CRUD productos |
| GET/PATCH | `/api/products/[id]` | Detalle/editar producto |
| GET/POST | `/api/expense-categories` | CRUD categorías de gastos |
| GET/POST | `/api/users` | CRUD usuarios |

### 16.7. Dashboard

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/dashboard/kpis` | 8 KPIs con sparklines |
| GET | `/api/dashboard/revenue` | Datos de facturación vs cobranza |
| GET | `/api/dashboard/production` | Distribución de producción por flujo |
| GET | `/api/dashboard/invoice-vs-expenses` | Facturación vs gastos por periodo |
| GET | `/api/dashboard/top-clients` | Top 5 clientes por facturación |
| GET | `/api/dashboard/bottlenecks` | Cuellos de botella por paso |
| GET | `/api/dashboard/activity` | Actividad reciente del sistema |

### 16.8. Portal

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/portal/orders` | Pedidos del cliente autenticado con progreso |
| GET | `/api/portal/account` | Datos de perfil del cliente |
| PATCH | `/api/portal/account` | Actualizar perfil del cliente |

---

## 17. Componentes UI Reutilizables

| Componente | Archivo | Descripción |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | Primary, secondary, danger, ghost + loading spinner |
| `Input` / `Select` | `components/ui/Input.tsx` | Campos de formulario con labels, error y variantes |
| `Badge` | `components/ui/Badge.tsx` | Badges de estado con colores semánticos |
| `Modal` | `components/ui/Modal.tsx` | Modal genérico con overlay |
| `ConfirmDialog` | `components/ui/ConfirmDialog.tsx` | Diálogo de confirmación (reemplaza `confirm()`) |
| `Toast` / `ToastProvider` | `components/ui/Toast.tsx` | Notificaciones temporales (success, error, warning) |
| `EmptyState` | `components/ui/EmptyState.tsx` | Estado vacío con icono y mensaje |
| `Skeleton` | `components/ui/Skeleton.tsx` | Placeholders de carga animados |
| `ClientCombobox` | `components/ui/ClientCombobox.tsx` | Selector de cliente con búsqueda en tiempo real |
| `ChangePasswordModal` | `components/auth/ChangePasswordModal.tsx` | Modal de cambio de contraseña (forzado u opcional) |

---

## 18. Middleware y Seguridad

### 18.1. Protección de Rutas

El middleware (`src/middleware.ts`) opera en Edge Runtime y controla el acceso basado en roles:

```typescript
const ROLE_ACCESS = {
  admin: ['/dashboard', '/orders', '/clients', '/finances', '/expenses', '/settings', '/api'],
  tech: ['/dashboard', '/orders', '/api'],
  client: ['/portal', '/api/auth', '/api/portal', '/api/clients'],
};
```

### 18.2. Rutas Públicas

* `/` — Login
* `/api/auth/login` — API de login
* `/api/health` — Health check
* `/api/ping` — Ping

### 18.3. Sesión

* **Cookie:** `sjlab-session` (JWT firmado con HMAC-SHA256)
* **Payload:** `{ id, name, email, role, clinicName, mustChangePassword }`
* **Refresh:** Se regenera al cambiar contraseña para actualizar `mustChangePassword`.

---

## 19. Responsive Design

### 19.1. Breakpoints Estándar

| Breakpoint | Ancho | Uso |
|---|---|---|
| Desktop | > 1024px | Layout completo con sidebar expandido |
| Tablet | 768px – 1024px | Sidebar colapsado, grids adaptados |
| Mobile | < 768px | Layout vertical, cards full-width |
| Small Mobile | < 480px | Tipografía reducida, padding compacto |

### 19.2. Módulos Responsive

Todos los módulos (dashboard, orders, clients, expenses, finances, settings) tienen media queries dedicadas en sus archivos CSS Module con los breakpoints estándar.

---

## 20. Notificaciones (Alcance Actual)

Las notificaciones son pasivas (no hay push ni email):

* **Para el Admin:** La tabla de "Actividad Reciente" en el dashboard funciona como feed de novedades.
* **Para el Cliente:** Al ingresar al portal, los pedidos muestran su estado actual con barra de progreso en tiempo real.

> En versiones futuras se podrá integrar notificación por email o webhook para cambios de estado.