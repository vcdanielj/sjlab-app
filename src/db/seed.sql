-- SJ Lab Seed Data (Auto-generated)

INSERT INTO workflows (id, name, is_active, created_at) VALUES
('6b10f18bb45f4a7389a5', 'Acrílico Convencional', 1, 1780008068),
('de6230833b904a729f4b', 'Inyección', 1, 1780008068),
('2a68291d586c419ba9f5', 'Digital Simplificado', 1, 1780008068);

INSERT INTO workflow_steps (id, workflow_id, name, sort_order, is_active) VALUES
('7a927ace0e84443a8270', '6b10f18bb45f4a7389a5', 'Preparación de modelo', 1, 1),
('3f6dad90acd649ffab24', '6b10f18bb45f4a7389a5', 'Cubetas individuales', 2, 1),
('7031dde13ca34323a892', '6b10f18bb45f4a7389a5', 'Placa base con rodetes', 3, 1),
('fd3d864be6554b3bb888', '6b10f18bb45f4a7389a5', 'Montaje de articulador', 4, 1),
('5444222caeda4491bbf2', '6b10f18bb45f4a7389a5', 'Enfilado', 5, 1),
('ec31e90a850e4d31af54', '6b10f18bb45f4a7389a5', 'Enmuflado', 6, 1),
('772065fb53504a4cb746', '6b10f18bb45f4a7389a5', 'Acrilizado', 7, 1),
('be1b0ab621a342c19b5b', '6b10f18bb45f4a7389a5', 'Tallado y pulido', 8, 1),
('dd3c4d6f8d974e31bac6', 'de6230833b904a729f4b', 'Preparación de modelo', 1, 1),
('32ebbe78db3c46a5a2ee', 'de6230833b904a729f4b', 'Cubetas individuales', 2, 1),
('ba835c89787a49cabd6e', 'de6230833b904a729f4b', 'Placa base con rodetes', 3, 1),
('4040ae8732534e3ea06d', 'de6230833b904a729f4b', 'Montaje de articulador', 4, 1),
('7d885e7e4d984023b630', 'de6230833b904a729f4b', 'Enfilado', 5, 1),
('7d659bfca5b846a490ad', 'de6230833b904a729f4b', 'Enmuflado', 6, 1),
('19f21ce6737e42229582', 'de6230833b904a729f4b', 'Inyección', 7, 1),
('f04cd29d19e343d08906', 'de6230833b904a729f4b', 'Tallado y pulido', 8, 1),
('f0c8a6faf5e641679f36', '2a68291d586c419ba9f5', 'Recepción de archivo / Escaneo', 1, 1),
('94a6572afb1d43a0be5b', '2a68291d586c419ba9f5', 'Diseño digital (CAD)', 2, 1),
('49b9e2f18988476d91ef', '2a68291d586c419ba9f5', 'Impresión / Fabricación', 3, 1),
('7b2bc893aebc4c31958f', '2a68291d586c419ba9f5', 'Acabado y control de calidad', 4, 1);

INSERT INTO categories (id, name, sort_order) VALUES
('d9ddf5547947439cae28', 'Prótesis Totales', 1),
('59d164c8d39f4686afcd', 'PPR Acrílicas', 2),
('ed2b0d9d0abc49cfb005', 'PPR Inyectadas', 3),
('062f29b6db6a4298bc51', 'PPR Valplast', 4),
('38bacba4e4ba4769a7b1', 'Férulas', 5),
('81e9963be759497a920a', 'Estética / Fija', 6),
('614295a4761c4540a27d', 'Flujo Digital', 7);

INSERT INTO products (id, category_id, workflow_id, name, details, suggested_price_usd, is_active, created_at) VALUES
('2dd685c2322c4b889b85', 'd9ddf5547947439cae28', '6b10f18bb45f4a7389a5', 'Prótesis Total Acrílica', 'A partir de 9 UD (Inc. cubeta e/rodetes)', 100, 1, 1780008068),
('7e324fb4554a4e56b8db', 'd9ddf5547947439cae28', '6b10f18bb45f4a7389a5', 'Totales Acrílicas Caracterizadas', NULL, 120, 1, 1780008068),
('4bb25e197ff242e1b9b4', 'd9ddf5547947439cae28', 'de6230833b904a729f4b', 'Prótesis Total Inyectada', NULL, 120, 1, 1780008068),
('b57a66a87aa04aad93c4', '59d164c8d39f4686afcd', '6b10f18bb45f4a7389a5', 'PPR Acrílica (1–3 UD)', '1 a 3 Unidades Dentales', 50, 1, 1780008068),
('8232a2a2cd9a45999bc0', '59d164c8d39f4686afcd', '6b10f18bb45f4a7389a5', 'PPR Acrílica (4–6 UD)', '4 a 6 Unidades Dentales', 60, 1, 1780008068),
('5a53bb390b0a4d12acc9', '59d164c8d39f4686afcd', '6b10f18bb45f4a7389a5', 'PPR Acrílica (7–8 UD)', '7 a 8 Unidades Dentales', 70, 1, 1780008068),
('15a68025bd0d42e39932', 'ed2b0d9d0abc49cfb005', 'de6230833b904a729f4b', 'Acrílico Inyectado (1–3 UD)', '1 a 3 Unidades Dentales', 80, 1, 1780008068),
('50faeb67c729421da880', 'ed2b0d9d0abc49cfb005', 'de6230833b904a729f4b', 'Acrílico Inyectado (4–6 UD)', '4 a 6 Unidades Dentales', 90, 1, 1780008068),
('e7aa253737fd476381a0', 'ed2b0d9d0abc49cfb005', 'de6230833b904a729f4b', 'Acrílico Inyectado (7–8 UD)', '7 a 8 Unidades Dentales', 100, 1, 1780008068),
('a1d2f12b4bb748cfb779', '062f29b6db6a4298bc51', 'de6230833b904a729f4b', 'Prótesis Valplast (1–3 UD)', '1 a 3 Unidades Dentales', 80, 1, 1780008068),
('a172d42623d54a789dff', '062f29b6db6a4298bc51', 'de6230833b904a729f4b', 'Prótesis Valplast (4–6 UD)', '4 a 6 Unidades Dentales', 90, 1, 1780008068),
('df5d814369104919807f', '062f29b6db6a4298bc51', 'de6230833b904a729f4b', 'Prótesis Valplast (7–8 UD)', '7 a 8 Unidades Dentales', 100, 1, 1780008068),
('4e16429160d741429f2a', '38bacba4e4ba4769a7b1', '6b10f18bb45f4a7389a5', 'Férula para Bruxismo (Termo)', NULL, 45, 1, 1780008068),
('a99f991eb62d46da9bcd', '38bacba4e4ba4769a7b1', '6b10f18bb45f4a7389a5', 'Férula de Acetato', 'Precio unitario (c/u)', 20, 1, 1780008068),
('a857720904de4734adf2', '38bacba4e4ba4769a7b1', '6b10f18bb45f4a7389a5', 'Férula de Acetato Híbrida', NULL, 30, 1, 1780008068),
('a30ef77cc35e4268839c', '81e9963be759497a920a', '6b10f18bb45f4a7389a5', 'Provisionales', 'Precio unitario', 15, 1, 1780008068),
('06e832f8808048b1b25f', '81e9963be759497a920a', '6b10f18bb45f4a7389a5', 'Incrustaciones en Ceramage', NULL, 40, 1, 1780008068),
('c070e6087c7d4e64a216', '81e9963be759497a920a', '6b10f18bb45f4a7389a5', 'Coronas en Ceramage', NULL, 45, 1, 1780008068),
('3463d84d59224c54bcf3', '614295a4761c4540a27d', '2a68291d586c419ba9f5', 'Encerado Diagnóstico Digital', 'Precio por cada UD', 10, 1, 1780008068),
('d9bec9435fe448ecac36', '614295a4761c4540a27d', '2a68291d586c419ba9f5', 'Escaneo Intraoral', NULL, 40, 1, 1780008068),
('74f4a6bbc7524066af6c', '614295a4761c4540a27d', '2a68291d586c419ba9f5', 'Impresión de Modelos 3D', 'Articulado', 15, 1, 1780008068);

INSERT INTO users (id, name, email, password_hash, phone, clinic_name, tax_id, role, is_active, must_change_password, created_at) VALUES
('f5a81eeb3a1049bf98df', 'Administrador SJ Lab', 'admin@sjlabdental.com', 'a2d529d4f6436a00cd004dfea1928ae5:b71ea219a4e6c29f8550b064f3bfbda94c92417642ef871d26735b6b61458ec7', '+58 412-0000000', NULL, NULL, 'admin', 1, 0, 1780008068),
('a65e201f29764b73a4cd', 'Dr. Carlos Mendoza', 'carlos.mendoza@email.com', '5403d80d58b913a00762d3bb426966f8:e3cff5480301f783c95ae4e438d95ef733d3e344d45edfae12c874484adf0d5c', '+58 414-1234567', 'Clínica Dental Mendoza', 'V-12345678', 'client', 1, 1, 1780008068),
('8345a15710d2497282fe', 'Dra. María González', 'maria.gonzalez@email.com', '5403d80d58b913a00762d3bb426966f8:e3cff5480301f783c95ae4e438d95ef733d3e344d45edfae12c874484adf0d5c', '+58 424-7654321', 'Sonrisa Perfecta', 'V-98765432', 'client', 1, 1, 1780008068),
('b37dce846029407cb1cb', 'Juan Pérez', 'juan.perez@email.com', '0e1cec06b5c79a0a6a3f5d7a321dce91:9675006cf309bc48338f6609d99b940f37e8e8eda57d64e674e987aa02546f54', '+58 412-5555555', NULL, NULL, 'tech', 1, 1, 1780008068);
