# 🦷 SJ Lab — Sistema de Gestión Integral para Laboratorios Dentales y Médicos

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed-Cloudflare%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1%20(SQLite)-f38020?logo=cloudflare)](https://developers.cloudflare.com/d1/)

**SJ Lab** es una plataforma ERP/SaaS de alto rendimiento diseñada específicamente para la gestión operativa, financiera, de tesorería y entrega de pedidos en laboratorios dentales y prostéticos.

🔗 **Demo en Producción**: [https://sjlab-app.vcdanielj.workers.dev](https://sjlab-app.vcdanielj.workers.dev)

---

## 🌟 Características Principales

### 1. 📊 Dashboard de Analítica y KPIs
- Indicadores clave en tiempo real: Pedidos activos, completados, facturación del periodo y cuentas por cobrar (CxC).
- Monitor de cuellos de botella por paso del flujo de trabajo (Workflow).
- Gráficos de ingresos vs. gastos y desglose de producción.

### 2. 📑 Gestión de Pedidos y Trabajos Prostéticos
- Seguimiento completo desde la toma de impresión hasta la entrega final.
- Configuración de colores personalizados por estándares (VITA Classic, 3D Master, Bleach, etc.).
- Excepciones por paciente y flujo de aprobación por técnico.

### 3. 🏦 Tesorería y Saldos (Cuentas Multimoneda)
- **Saldos Dinámicos al 01/08/2026**: Seguimiento en tiempo real de cuentas en **Zelle (USD)**, **Binance (USD)**, **Efectivo (USD)** y **Bolívares (VES)**.
- **Cobros y Gastos Automáticos**: Imputación o débito automático en las cuentas al registrar pagos de clientes o egresos.
- **Transferencias entre Cuentas**: Transferencias con calculadora multimoneda (USD ↔ VES) basada en la tasa de cambio del día.
- **Ajustes de Saldo con Motivo Obligatorio**: Registro auditado de ajustes (+ / -) por comisiones, diferencial cambiario o rendimientos.
- **Estado de Cuentas y Exportación CSV**: Extracto bancario cronológico con saldo progresivo por movimiento.
- **Arqueo y Cierre de Caja**: Conciliación entre saldo teórico del sistema y arqueo físico real.

### 4. 💵 Finanzas, CxC y Facturación Bi-Moneda
- Pagos multimoneda con fórmulas bi-moneda (USD Comercial / FIFO vs USD Real Consolidado).
- Distribución automática de cobros a pedidos mediante algoritmo FIFO o asignación manual.
- Estados de cuenta detallados por clínica / cliente.

### 5. 🚚 Módulo de Delivery y Mensajería
- Despacho y asignación de motorizados / repartidores.
- Seguimiento de estados de recogida y entrega en clínicas dentales.

---

## 🛠️ Tecnologías Utilizadas

- **Framework**: Next.js 16 (App Router)
- **Runtime**: Cloudflare Edge Workers vía OpenNext (`@opennextjs/cloudflare`)
- **Base de Datos**: Cloudflare D1 (SQLite serverless de baja latencia)
- **ORM**: Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Estilos**: Vanilla CSS Modules (Design System Tokens)
- **Pruebas**: Vitest

---

## 🚀 Instalación y Desarrollo Local

### Prerrequisitos
- Node.js ≥ 20.x
- npm ≥ 10.x
- Cloudflare Wrangler CLI (`npm i -g wrangler`)

### 1. Clonar el Repositorio
```bash
git clone https://github.com/vcdanielj/sjlab-app.git
cd sjlab-app
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Ejecutar Migraciones Locales (D1 SQLite)
```bash
npm run db:migrate
```

### 4. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📜 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo de Next.js |
| `npm run build` | Compila la aplicación localmente |
| `npm test` | Ejecuta el suite de pruebas con Vitest |
| `npm run db:generate` | Genera archivos de migración SQL con Drizzle Kit |
| `npm run db:migrate` | Aplica migraciones SQL a la base de datos D1 local |
| `npm run db:migrate:prod` | Aplica migraciones SQL a la base de datos D1 remota |
| `npm run deploy` | Compila con OpenNext y despliega a Cloudflare Workers |

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Para más detalles, consulta el archivo [LICENSE](LICENSE).
