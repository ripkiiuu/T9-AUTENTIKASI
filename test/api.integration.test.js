import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

// Integration test nyata; jalankan hanya jika DATABASE_URL ada dan migrasi sudah diterapkan.
test('auth, CRUD, filter, relasi, konflik, dan stok pada MySQL', { skip: !process.env.DATABASE_URL }, async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const suffix = `${Date.now()}-${process.pid}`;
  const email = `uji.integrasi.${suffix}@unram.ac.id`;
  const password = 'rahasia123';
  const sku = `BKT-F1D02410080-TEST-${suffix}`;
  const sku2 = `BKT-F1D02410080-TEST2-${suffix}`;
  const productIds = [];
  let token;

  async function req(method, path, body, pakaiToken = false) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(pakaiToken && { authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }

  try {
    // Akun uji dibuat lewat endpoint, bukan seeder.
    assert.equal((await req('POST', '/auth/register', { email, password })).status, 201);
    const login = await req('POST', '/auth/login', { email, password });
    assert.equal(login.status, 200);
    token = login.body.data.token;
    assert.equal((await req('GET', '/auth/saya', undefined, true)).body.data.id > 0, true);

    // Halaman publik tetap terbuka tanpa token.
    let response = await req('GET', '/products?halaman=1&ukuran=5&category=Wisuda');
    assert.equal(response.status, 200);
    assert.equal(response.body.meta.ukuran, 5);
    assert.ok(response.body.data.every((row) => row.category === 'Wisuda'));

    // Aksi menulis tanpa token ditolak sebelum validasi.
    assert.equal((await req('POST', '/products', {})).status, 401);

    const input = {
      sku, name: 'Uji Muhammad Rifqy Habibi F1D02410080', category: 'Wisuda',
      price: 125000, stock: 1,
    };
    response = await req('POST', '/products', input, true);
    assert.equal(response.status, 201);
    const id = response.body.data.id;
    productIds.push(id);
    assert.equal((await req('GET', `/products/${id}`)).status, 200);
    assert.equal((await req('GET', '/products/99999999')).status, 404);
    assert.equal((await req('POST', '/products', input, true)).status, 409);

    response = await req('PUT', `/products/${id}`, { ...input, price: 130000 }, true);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.price, '130000');

    // Dua pesanan berebut satu stok: tepat satu 201 dan satu 409.
    const orderInput = { productId: id, customerName: 'Pelanggan Demo F1D02410080', quantity: 1 };
    assert.equal((await req('POST', '/orders', orderInput)).status, 401);
    const two = await Promise.all([
      req('POST', '/orders', orderInput, true), req('POST', '/orders', orderInput, true),
    ]);
    assert.deepEqual(two.map((r) => r.status).sort(), [201, 409]);
    assert.equal(two.find((r) => r.status === 201).body.data.totalPrice, '130000');
    assert.equal((await prisma.product.findUnique({ where: { id } })).stock, 0);
    assert.equal(await prisma.order.count({ where: { productId: id } }), 1);
    assert.equal((await req('DELETE', `/products/${id}`, undefined, true)).status, 409);

    response = await req('GET', '/orders');
    assert.equal(response.status, 200);
    assert.equal(response.body.data.find((row) => row.productId === id).product.sku, sku);

    response = await req('POST', '/products', { ...input, sku: sku2 }, true);
    assert.equal(response.status, 201);
    productIds.push(response.body.data.id);
    assert.equal((await req('DELETE', `/products/${response.body.data.id}`, undefined, true)).status, 204);
    productIds.pop();
  } finally {
    // Hanya data sementara milik test yang dihapus; seed dan data mahasiswa lain tetap utuh.
    if (productIds.length) {
      await prisma.order.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    await prisma.user.deleteMany({ where: { email } });
    server.close();
    await prisma.$disconnect();
  }
});
