// ============================================
// SJ Lab — Database Seed Script
// ============================================
// Run with: npx wrangler d1 execute sjlab-local --local --file=./src/db/seed.sql
// Or programmatically via the API during development.

import { generateId, now } from '@/lib/utils';
import { hashPassword } from '@/lib/password';
import type { Database } from './index';
import * as schema from './schema';

export async function seed(db: Database) {
  const timestamp = now();

  // Hash passwords for seed users (all use 'admin123' for dev)
  const adminHash = await hashPassword('admin123');
  const clientHash = await hashPassword('cliente123');
  const techHash = await hashPassword('tecnico123');

  // ==========================================
  // 1. WORKFLOWS
  // ==========================================

  const wfConvencional = generateId();
  const wfInyeccion = generateId();
  const wfDigital = generateId();

  await db.insert(schema.workflows).values([
    { id: wfConvencional, name: 'Acrílico Convencional', isActive: true, createdAt: timestamp },
    { id: wfInyeccion, name: 'Inyección', isActive: true, createdAt: timestamp },
    { id: wfDigital, name: 'Digital Simplificado', isActive: true, createdAt: timestamp },
  ]);

  // ==========================================
  // 2. WORKFLOW STEPS
  // ==========================================

  // Steps: Acrílico Convencional (8 pasos)
  const stepsConvencional = [
    'Preparación de modelo',
    'Cubetas individuales',
    'Placa base con rodetes',
    'Montaje de articulador',
    'Enfilado',
    'Enmuflado',
    'Acrilizado',
    'Tallado y pulido',
  ];

  const convStepIds: string[] = [];
  for (let i = 0; i < stepsConvencional.length; i++) {
    const id = generateId();
    convStepIds.push(id);
    await db.insert(schema.workflowSteps).values({
      id,
      workflowId: wfConvencional,
      name: stepsConvencional[i],
      sortOrder: i + 1,
      isActive: true,
    });
  }

  // Steps: Inyección (8 pasos)
  const stepsInyeccion = [
    'Preparación de modelo',
    'Cubetas individuales',
    'Placa base con rodetes',
    'Montaje de articulador',
    'Enfilado',
    'Enmuflado',
    'Inyección',
    'Tallado y pulido',
  ];

  const injStepIds: string[] = [];
  for (let i = 0; i < stepsInyeccion.length; i++) {
    const id = generateId();
    injStepIds.push(id);
    await db.insert(schema.workflowSteps).values({
      id,
      workflowId: wfInyeccion,
      name: stepsInyeccion[i],
      sortOrder: i + 1,
      isActive: true,
    });
  }

  // Steps: Digital Simplificado (4 pasos)
  const stepsDigital = [
    'Recepción de archivo / Escaneo',
    'Diseño digital (CAD)',
    'Impresión / Fabricación',
    'Acabado y control de calidad',
  ];

  const digStepIds: string[] = [];
  for (let i = 0; i < stepsDigital.length; i++) {
    const id = generateId();
    digStepIds.push(id);
    await db.insert(schema.workflowSteps).values({
      id,
      workflowId: wfDigital,
      name: stepsDigital[i],
      sortOrder: i + 1,
      isActive: true,
    });
  }

  // ==========================================
  // 3. CATEGORIES
  // ==========================================

  const catProtTotales = generateId();
  const catPprAcrilicas = generateId();
  const catPprInyectadas = generateId();
  const catPprValplast = generateId();
  const catFerulas = generateId();
  const catEstetica = generateId();
  const catDigital = generateId();

  await db.insert(schema.categories).values([
    { id: catProtTotales, name: 'Prótesis Totales', sortOrder: 1 },
    { id: catPprAcrilicas, name: 'PPR Acrílicas', sortOrder: 2 },
    { id: catPprInyectadas, name: 'PPR Inyectadas', sortOrder: 3 },
    { id: catPprValplast, name: 'PPR Valplast', sortOrder: 4 },
    { id: catFerulas, name: 'Férulas', sortOrder: 5 },
    { id: catEstetica, name: 'Estética / Fija', sortOrder: 6 },
    { id: catDigital, name: 'Flujo Digital', sortOrder: 7 },
  ]);

  // ==========================================
  // 4. PRODUCTS (21 from PRD catalog)
  // ==========================================

  const productData = [
    // Prótesis Totales
    { catId: catProtTotales, wfId: wfConvencional, name: 'Prótesis Total Acrílica', details: 'A partir de 9 UD (Inc. cubeta e/rodetes)', price: 100 },
    { catId: catProtTotales, wfId: wfConvencional, name: 'Totales Acrílicas Caracterizadas', details: null, price: 120 },
    { catId: catProtTotales, wfId: wfInyeccion, name: 'Prótesis Total Inyectada', details: null, price: 120 },
    // PPR Acrílicas
    { catId: catPprAcrilicas, wfId: wfConvencional, name: 'PPR Acrílica (1–3 UD)', details: '1 a 3 Unidades Dentales', price: 50 },
    { catId: catPprAcrilicas, wfId: wfConvencional, name: 'PPR Acrílica (4–6 UD)', details: '4 a 6 Unidades Dentales', price: 60 },
    { catId: catPprAcrilicas, wfId: wfConvencional, name: 'PPR Acrílica (7–8 UD)', details: '7 a 8 Unidades Dentales', price: 70 },
    // PPR Inyectadas
    { catId: catPprInyectadas, wfId: wfInyeccion, name: 'Acrílico Inyectado (1–3 UD)', details: '1 a 3 Unidades Dentales', price: 80 },
    { catId: catPprInyectadas, wfId: wfInyeccion, name: 'Acrílico Inyectado (4–6 UD)', details: '4 a 6 Unidades Dentales', price: 90 },
    { catId: catPprInyectadas, wfId: wfInyeccion, name: 'Acrílico Inyectado (7–8 UD)', details: '7 a 8 Unidades Dentales', price: 100 },
    // PPR Valplast
    { catId: catPprValplast, wfId: wfInyeccion, name: 'Prótesis Valplast (1–3 UD)', details: '1 a 3 Unidades Dentales', price: 80 },
    { catId: catPprValplast, wfId: wfInyeccion, name: 'Prótesis Valplast (4–6 UD)', details: '4 a 6 Unidades Dentales', price: 90 },
    { catId: catPprValplast, wfId: wfInyeccion, name: 'Prótesis Valplast (7–8 UD)', details: '7 a 8 Unidades Dentales', price: 100 },
    // Férulas
    { catId: catFerulas, wfId: wfConvencional, name: 'Férula para Bruxismo (Termo)', details: null, price: 45 },
    { catId: catFerulas, wfId: wfConvencional, name: 'Férula de Acetato', details: 'Precio unitario (c/u)', price: 20 },
    { catId: catFerulas, wfId: wfConvencional, name: 'Férula de Acetato Híbrida', details: null, price: 30 },
    // Estética / Fija
    { catId: catEstetica, wfId: wfConvencional, name: 'Provisionales', details: 'Precio unitario', price: 15 },
    { catId: catEstetica, wfId: wfConvencional, name: 'Incrustaciones en Ceramage', details: null, price: 40 },
    { catId: catEstetica, wfId: wfConvencional, name: 'Coronas en Ceramage', details: null, price: 45 },
    // Flujo Digital
    { catId: catDigital, wfId: wfDigital, name: 'Encerado Diagnóstico Digital', details: 'Precio por cada UD', price: 10 },
    { catId: catDigital, wfId: wfDigital, name: 'Escaneo Intraoral', details: null, price: 40 },
    { catId: catDigital, wfId: wfDigital, name: 'Impresión de Modelos 3D', details: 'Articulado', price: 15 },
  ];

  for (const p of productData) {
    await db.insert(schema.products).values({
      id: generateId(),
      categoryId: p.catId,
      workflowId: p.wfId,
      name: p.name,
      details: p.details,
      suggestedPriceUsd: p.price,
      isActive: true,
      createdAt: timestamp,
    });
  }

  // ==========================================
  // 5. USERS (admin + test clients)
  // ==========================================

  // ==========================================
  // 5. USERS (admin + test clients + tech)
  // ==========================================

  await db.insert(schema.users).values([
    {
      id: generateId(),
      name: 'Administrador SJ Lab',
      email: 'admin@sjlabdental.com',
      passwordHash: adminHash,
      phone: '+58 412-0000000',
      clinicName: null,
      taxId: null,
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
      createdAt: timestamp,
    },
    {
      id: generateId(),
      name: 'Dr. Carlos Mendoza',
      email: 'carlos.mendoza@email.com',
      passwordHash: clientHash,
      phone: '+58 414-1234567',
      clinicName: 'Clínica Dental Mendoza',
      taxId: 'V-12345678',
      role: 'client',
      isActive: true,
      mustChangePassword: true,
      createdAt: timestamp,
    },
    {
      id: generateId(),
      name: 'Dra. María González',
      email: 'maria.gonzalez@email.com',
      passwordHash: clientHash,
      phone: '+58 424-7654321',
      clinicName: 'Sonrisa Perfecta',
      taxId: 'V-98765432',
      role: 'client',
      isActive: true,
      mustChangePassword: true,
      createdAt: timestamp,
    },
    {
      id: generateId(),
      name: 'Juan Pérez',
      email: 'juan.perez@email.com',
      passwordHash: techHash,
      phone: '+58 412-5555555',
      clinicName: null,
      taxId: null,
      role: 'tech',
      isActive: true,
      mustChangePassword: true,
      createdAt: timestamp,
    },
  ]);

  console.log('✅ Seed completed: 3 workflows, 20 steps, 7 categories, 21 products, 4 users');
}
