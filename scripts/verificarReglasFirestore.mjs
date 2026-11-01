import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { aplicarCorreccionAbono } from '../src/services/correccionAbono.js';

const reglas = await readFile(
  fileURLToPath(new URL('../firestore.rules', import.meta.url)),
  'utf8'
);

let entorno;

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'demo-masucri-rules',
    firestore: { host: '127.0.0.1', port: 8180, rules: reglas }
  });

  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), 'pedidos', 'pedido-existente'), {
      estado: 'Pendiente'
    });
  });
});

after(async () => {
  await entorno?.cleanup();
});

function contextoCon(email, { verificado = true, proveedor = 'google.com' } = {}) {
  return entorno.authenticatedContext(`usuario-${email}-${proveedor}-${verificado}`, {
    email,
    email_verified: verificado,
    firebase: { sign_in_provider: proveedor }
  });
}

async function comprobarAcceso(contexto, permitido, id) {
  const pedido = doc(contexto.firestore(), 'pedidos', 'pedido-existente');
  const movimiento = doc(contexto.firestore(), 'movimientos', id);

  if (permitido) {
    await assertSucceeds(getDoc(pedido));
    await assertSucceeds(setDoc(movimiento, { monto: 1000 }));
  } else {
    await assertFails(getDoc(pedido));
    await assertFails(setDoc(movimiento, { monto: 1000 }));
  }
}

test('los dos administradores con Google y correo verificado pueden leer y escribir', async () => {
  await comprobarAcceso(contextoCon('ulloarodriguezchris@gmail.com'), true, 'admin-1');
  await comprobarAcceso(contextoCon('anisrmj5@gmail.com'), true, 'admin-2');
});

test('un correo externo no puede leer ni escribir', async () => {
  await comprobarAcceso(contextoCon('externo@gmail.com'), false, 'externo');
});

test('el correo de un administrador sin verificar no obtiene acceso', async () => {
  await comprobarAcceso(
    contextoCon('ulloarodriguezchris@gmail.com', { verificado: false }),
    false,
    'sin-verificar'
  );
});

test('el correo de un administrador con otro proveedor no obtiene acceso', async () => {
  await comprobarAcceso(
    contextoCon('anisrmj5@gmail.com', { proveedor: 'password' }),
    false,
    'otro-proveedor'
  );
});

test('una sesión anónima no puede leer ni escribir', async () => {
  await comprobarAcceso(entorno.unauthenticatedContext(), false, 'sin-sesion');
});

test('dos correcciones concurrentes del mismo abono solo contabilizan una', async () => {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), 'pedidos', 'pedido-concurrente'), {
      precio: 2000, monto_pagado: 1000,
      historial_pagos: [{ fecha: '2026-10-31', monto: 1000, metodo: 'Efectivo', movimiento_id: 'pago-concurrente' }]
    });
    await setDoc(doc(contexto.firestore(), 'movimientos', 'pago-concurrente'), {
      pedido_id: 'pedido-concurrente', tipo: 'entrada',
      fecha: '2026-10-31', monto: 1000, metodo_pago: 'Efectivo'
    });
  });

  const dbAdmin = contextoCon('ulloarodriguezchris@gmail.com').firestore();
  const correcciones = await Promise.allSettled([
    aplicarCorreccionAbono(dbAdmin, 'pedido-concurrente', 'pago-concurrente',
      { fecha: '2026-10-31', monto: 750, metodo: 'Efectivo' }, { motivo: 'Monto', usuario: 'admin' }),
    aplicarCorreccionAbono(dbAdmin, 'pedido-concurrente', 'pago-concurrente',
      { fecha: '2026-10-31', monto: 900, metodo: 'Efectivo' }, { motivo: 'Monto', usuario: 'admin' })
  ]);
  assert.equal(correcciones.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(correcciones.filter(({ status }) => status === 'rejected').length, 1);

  const pedidoFinal = (await getDoc(doc(dbAdmin, 'pedidos', 'pedido-concurrente'))).data();
  const movimientosFinales = (await getDocs(query(
    collection(dbAdmin, 'movimientos'), where('pedido_id', '==', 'pedido-concurrente')
  ))).docs.map((movimiento) => movimiento.data());
  const vigentes = movimientosFinales.filter((movimiento) => !movimiento.anulado);
  assert.equal(vigentes.length, 1);
  assert.equal(movimientosFinales.filter((movimiento) => movimiento.anulado).length, 1);
  assert.equal(pedidoFinal.monto_pagado, vigentes[0].monto);
  assert.equal(pedidoFinal.historial_pagos.filter((pago) => !pago.anulado).length, 1);
});

test('anular un abono conserva su movimiento original y descuenta el saldo', async () => {
  await entorno.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), 'pedidos', 'pedido-anulado'), {
      precio: 2000, monto_pagado: 500,
      historial_pagos: [{ fecha: '2026-10-31', monto: 500, metodo: 'Efectivo', movimiento_id: 'pago-anulado' }]
    });
    await setDoc(doc(contexto.firestore(), 'movimientos', 'pago-anulado'), {
      pedido_id: 'pedido-anulado', tipo: 'entrada',
      fecha: '2026-10-31', monto: 500, metodo_pago: 'Efectivo'
    });
  });

  const dbAdmin = contextoCon('anisrmj5@gmail.com').firestore();
  await aplicarCorreccionAbono(dbAdmin, 'pedido-anulado', 'pago-anulado', null, {
    motivo: 'Registro duplicado', usuario: 'admin'
  });
  const pedidoFinal = (await getDoc(doc(dbAdmin, 'pedidos', 'pedido-anulado'))).data();
  const movimientoFinal = (await getDoc(doc(dbAdmin, 'movimientos', 'pago-anulado'))).data();
  assert.equal(pedidoFinal.monto_pagado, 0);
  assert.equal(pedidoFinal.historial_pagos[0].anulado, true);
  assert.equal(movimientoFinal.monto, 500);
  assert.equal(movimientoFinal.anulado, true);
  assert.equal(movimientoFinal.motivo_anulacion, 'Registro duplicado');
});
