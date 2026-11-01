import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
