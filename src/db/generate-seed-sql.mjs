// Quick script to generate password hashes and output seed SQL
// Run with: node --experimental-modules src/db/generate-seed-sql.mjs

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true, ['encrypt']
  );
  const hashBuffer = await crypto.subtle.exportKey('raw', key);
  return `${bufferToHex(salt)}:${bufferToHex(new Uint8Array(hashBuffer))}`;
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

async function main() {
  const ts = Math.floor(Date.now() / 1000);
  const adminHash = await hashPassword('admin123');
  const clientHash = await hashPassword('cliente123');
  const techHash = await hashPassword('tecnico123');

  // IDs
  const wfConv = generateId();
  const wfInj = generateId();
  const wfDig = generateId();

  const stepsConv = ['Preparación de modelo','Cubetas individuales','Placa base con rodetes','Montaje de articulador','Enfilado','Enmuflado','Acrilizado','Tallado y pulido'];
  const stepsInj = ['Preparación de modelo','Cubetas individuales','Placa base con rodetes','Montaje de articulador','Enfilado','Enmuflado','Inyección','Tallado y pulido'];
  const stepsDig = ['Recepción de archivo / Escaneo','Diseño digital (CAD)','Impresión / Fabricación','Acabado y control de calidad'];

  const convIds = stepsConv.map(() => generateId());
  const injIds = stepsInj.map(() => generateId());
  const digIds = stepsDig.map(() => generateId());

  const catIds = {
    protTotales: generateId(),
    pprAcrilicas: generateId(),
    pprInyectadas: generateId(),
    pprValplast: generateId(),
    ferulas: generateId(),
    estetica: generateId(),
    digital: generateId(),
  };

  let sql = '-- SJ Lab Seed Data (Auto-generated)\n\n';

  // Workflows
  sql += `INSERT INTO workflows (id, name, is_active, created_at) VALUES\n`;
  sql += `('${wfConv}', 'Acrílico Convencional', 1, ${ts}),\n`;
  sql += `('${wfInj}', 'Inyección', 1, ${ts}),\n`;
  sql += `('${wfDig}', 'Digital Simplificado', 1, ${ts});\n\n`;

  // Steps
  sql += `INSERT INTO workflow_steps (id, workflow_id, name, sort_order, is_active) VALUES\n`;
  const allSteps = [
    ...stepsConv.map((n, i) => `('${convIds[i]}', '${wfConv}', '${n}', ${i+1}, 1)`),
    ...stepsInj.map((n, i) => `('${injIds[i]}', '${wfInj}', '${n}', ${i+1}, 1)`),
    ...stepsDig.map((n, i) => `('${digIds[i]}', '${wfDig}', '${n}', ${i+1}, 1)`),
  ];
  sql += allSteps.join(',\n') + ';\n\n';

  // Categories
  sql += `INSERT INTO categories (id, name, sort_order) VALUES\n`;
  sql += `('${catIds.protTotales}', 'Prótesis Totales', 1),\n`;
  sql += `('${catIds.pprAcrilicas}', 'PPR Acrílicas', 2),\n`;
  sql += `('${catIds.pprInyectadas}', 'PPR Inyectadas', 3),\n`;
  sql += `('${catIds.pprValplast}', 'PPR Valplast', 4),\n`;
  sql += `('${catIds.ferulas}', 'Férulas', 5),\n`;
  sql += `('${catIds.estetica}', 'Estética / Fija', 6),\n`;
  sql += `('${catIds.digital}', 'Flujo Digital', 7);\n\n`;

  // Products
  const products = [
    [catIds.protTotales, wfConv, 'Prótesis Total Acrílica', 'A partir de 9 UD (Inc. cubeta e/rodetes)', 100],
    [catIds.protTotales, wfConv, 'Totales Acrílicas Caracterizadas', null, 120],
    [catIds.protTotales, wfInj, 'Prótesis Total Inyectada', null, 120],
    [catIds.pprAcrilicas, wfConv, 'PPR Acrílica (1–3 UD)', '1 a 3 Unidades Dentales', 50],
    [catIds.pprAcrilicas, wfConv, 'PPR Acrílica (4–6 UD)', '4 a 6 Unidades Dentales', 60],
    [catIds.pprAcrilicas, wfConv, 'PPR Acrílica (7–8 UD)', '7 a 8 Unidades Dentales', 70],
    [catIds.pprInyectadas, wfInj, 'Acrílico Inyectado (1–3 UD)', '1 a 3 Unidades Dentales', 80],
    [catIds.pprInyectadas, wfInj, 'Acrílico Inyectado (4–6 UD)', '4 a 6 Unidades Dentales', 90],
    [catIds.pprInyectadas, wfInj, 'Acrílico Inyectado (7–8 UD)', '7 a 8 Unidades Dentales', 100],
    [catIds.pprValplast, wfInj, 'Prótesis Valplast (1–3 UD)', '1 a 3 Unidades Dentales', 80],
    [catIds.pprValplast, wfInj, 'Prótesis Valplast (4–6 UD)', '4 a 6 Unidades Dentales', 90],
    [catIds.pprValplast, wfInj, 'Prótesis Valplast (7–8 UD)', '7 a 8 Unidades Dentales', 100],
    [catIds.ferulas, wfConv, 'Férula para Bruxismo (Termo)', null, 45],
    [catIds.ferulas, wfConv, 'Férula de Acetato', 'Precio unitario (c/u)', 20],
    [catIds.ferulas, wfConv, 'Férula de Acetato Híbrida', null, 30],
    [catIds.estetica, wfConv, 'Provisionales', 'Precio unitario', 15],
    [catIds.estetica, wfConv, 'Incrustaciones en Ceramage', null, 40],
    [catIds.estetica, wfConv, 'Coronas en Ceramage', null, 45],
    [catIds.digital, wfDig, 'Encerado Diagnóstico Digital', 'Precio por cada UD', 10],
    [catIds.digital, wfDig, 'Escaneo Intraoral', null, 40],
    [catIds.digital, wfDig, 'Impresión de Modelos 3D', 'Articulado', 15],
  ];

  sql += `INSERT INTO products (id, category_id, workflow_id, name, details, suggested_price_usd, is_active, created_at) VALUES\n`;
  sql += products.map(([cat, wf, name, details, price]) => {
    const d = details ? `'${details}'` : 'NULL';
    return `('${generateId()}', '${cat}', '${wf}', '${name}', ${d}, ${price}, 1, ${ts})`;
  }).join(',\n') + ';\n\n';

  // Users
  sql += `INSERT INTO users (id, name, email, password_hash, phone, clinic_name, tax_id, role, is_active, must_change_password, created_at) VALUES\n`;
  sql += `('${generateId()}', 'Administrador SJ Lab', 'admin@sjlabdental.com', '${adminHash}', '+58 412-0000000', NULL, NULL, 'admin', 1, 0, ${ts}),\n`;
  sql += `('${generateId()}', 'Dr. Carlos Mendoza', 'carlos.mendoza@email.com', '${clientHash}', '+58 414-1234567', 'Clínica Dental Mendoza', 'V-12345678', 'client', 1, 1, ${ts}),\n`;
  sql += `('${generateId()}', 'Dra. María González', 'maria.gonzalez@email.com', '${clientHash}', '+58 424-7654321', 'Sonrisa Perfecta', 'V-98765432', 'client', 1, 1, ${ts}),\n`;
  sql += `('${generateId()}', 'Juan Pérez', 'juan.perez@email.com', '${techHash}', '+58 412-5555555', NULL, NULL, 'tech', 1, 1, ${ts});\n`;

  // Write to file
  const fs = await import('fs');
  fs.writeFileSync('src/db/seed.sql', sql);
  console.log('✅ seed.sql generated');
}

main();
