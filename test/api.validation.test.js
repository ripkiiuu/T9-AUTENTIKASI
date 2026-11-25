import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { skemaAuth } from '../src/validators/auth.validator.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const email = `uji.validasi.${Date.now()}@unram.ac.id`;
const password = 'rahasia123';

// Sebagian besar permintaan ditolak sebelum query DB; server tetap butuh MySQL untuk register/login.
const server = app.listen(0);
after(async () => {
  server.close();
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
const base = `http://127.0.0.1:${server.address().port}`;

async function request(path, method = 'GET', body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null];
}

test('register tidak valid ditolak 422', async () => {
  const [status, body] = await request('/auth/register', 'POST', { email: 'bukan-email', password: 'pendek' });
  assert.equal(status, 422);
  assert.equal(body.error.kode, 'VALIDATION_ERROR');
  const kosong = await fetch(`${base}/auth/register`, { method: 'POST' });
  assert.equal(kosong.status, 422);
  assert.equal((await kosong.json()).error.kode, 'VALIDATION_ERROR');
});

test('batas password dan field tambahan diperiksa Joi', () => {
  const periksa = (password, tambahan = {}) => skemaAuth.validate({ email, password, ...tambahan });
  assert.ok(periksa('a'.repeat(7)).error);
  assert.equal(periksa('a'.repeat(8)).error, undefined);
  assert.equal(periksa('a'.repeat(72)).error, undefined);
  assert.ok(periksa('a'.repeat(73)).error);
  assert.ok(periksa('😀'.repeat(20)).error); // 40 code units tetapi 80 byte UTF-8.
  assert.ok(periksa(password, { role: 'admin' }).error);
});

test('register, duplikat, dan passwordHash tidak ikut respons', async () => {
  let [status, body] = await request('/auth/register', 'POST', { email, password });
  assert.equal(status, 201);
  assert.equal(body.data.email, email);
  assert.equal(body.data.passwordHash, undefined);
  const tersimpan = await prisma.user.findUnique({ where: { email } });
  assert.equal(bcrypt.getRounds(tersimpan.passwordHash), 10);
  assert.equal(await bcrypt.compare(password, tersimpan.passwordHash), true);

  [status, body] = await request('/auth/register', 'POST', { email, password });
  assert.equal(status, 409);
  assert.equal(body.error.kode, 'EMAIL_DUPLIKAT');
});

test('login salah dan email tak dikenal memberi pesan yang sama', async () => {
  const salah = await request('/auth/login', 'POST', { email, password: 'salah-sekali' });
  assert.equal(salah[0], 401);
  assert.equal(salah[1].error.kode, 'LOGIN_GAGAL');
  assert.equal(salah[1].error.pesan, 'Email atau password salah');

  const takDikenal = await request('/auth/login', 'POST', { email: 'tidak.ada@unram.ac.id', password });
  assert.equal(takDikenal[0], 401);
  assert.deepEqual(takDikenal[1], salah[1]);
});

test('butuhLogin menolak tanpa token dan token rusak', async () => {
  let [status, body] = await request('/auth/saya');
  assert.equal(status, 401);
  assert.equal(body.error.kode, 'TOKEN_DIPERLUKAN');

  [status, body] = await request('/auth/saya', 'GET', undefined, 'asal.ketik.token');
  assert.equal(status, 401);
  assert.equal(body.error.kode, 'TOKEN_TIDAK_VALID');
});

test('token dipalsukan, signature salah, dan expired ditolak; token normal berlaku 2 jam', async () => {
  const [, login] = await request('/auth/login', 'POST', { email, password });
  const token = login.data.token;
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.exp - payload.iat, 7200);
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'id']);
  const [header, , signature] = token.split('.');
  const palsu = Buffer.from(JSON.stringify({ ...payload, id: 999 })).toString('base64url');
  const tokens = [
    `${header}.${palsu}.${signature}`,
    jwt.sign({ id: payload.id }, 'secret-yang-salah', { expiresIn: '2h' }),
    jwt.sign({ id: payload.id }, process.env.JWT_SECRET, { expiresIn: -1 }),
  ];
  for (const tidakSah of tokens) {
    const [status, body] = await request('/auth/saya', 'GET', undefined, tidakSah);
    assert.equal(status, 401);
    assert.equal(body.error.kode, 'TOKEN_TIDAK_VALID');
  }
});

test('semua route penulisan mengautentikasi sebelum validasi', async () => {
  for (const [path, method] of [['/products', 'POST'], ['/products/abc', 'PUT'], ['/products/abc', 'DELETE'], ['/orders', 'POST']]) {
    const [status, body] = await request(path, method, {});
    assert.equal(status, 401);
    assert.equal(body.error.kode, 'TOKEN_DIPERLUKAN');
  }
  const response = await fetch(`${base}/auth/saya`, { headers: { authorization: 'Basic abc' } });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.kode, 'TOKEN_DIPERLUKAN');
});

test('halaman publik bisa dibuka tanpa token', async () => {
  assert.equal((await request('/products'))[0], 200);
  assert.equal((await request('/orders'))[0], 200);
  assert.equal((await request('/products', 'GET', undefined, 'asal.ketik.token'))[0], 200);
});

test('tambah produk tanpa token 401, dengan token divalidasi 400', async () => {
  assert.equal((await request('/products', 'POST', {}))[0], 401);

  const [, login] = await request('/auth/login', 'POST', { email, password });
  const token = login.data.token;
  const [status, body] = await request('/products', 'POST', {}, token);
  assert.equal(status, 400);
  assert.equal(body.error.kode, 'VALIDATION_ERROR');
});

test('POST tanpa JSON dengan token ditolak 400, bukan error Prisma 500', async () => {
  const [, login] = await request('/auth/login', 'POST', { email, password });
  const response = await fetch(`${base}/products`, {
    method: 'POST', headers: { authorization: `Bearer ${login.data.token}` },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.kode, 'VALIDATION_ERROR');
});

test('ID dan query tidak valid ditolak', async () => {
  assert.equal((await request('/products/abc'))[0], 400);
  assert.equal((await request('/products?halaman=0&ukuran=200'))[0], 400);
});

test('order dengan jumlah nol ditolak 400 setelah login', async () => {
  const [, login] = await request('/auth/login', 'POST', { email, password });
  const [status] = await request('/orders', 'POST', {
    productId: 1, customerName: 'Demo', quantity: 0,
  }, login.data.token);
  assert.equal(status, 400);
});

test('JSON rusak dan route tak ada memakai format error seragam', async () => {
  const response = await fetch(`${base}/products`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.kode, 'INVALID_JSON');
  assert.equal((await request('/tidak-ada'))[0], 404);
});

test('error internal terkontrol tidak membocorkan detail pada respons', async () => {
  // Aplikasi mini khusus proses test, bukan route debug dalam aplikasi final.
  const mini = express();
  mini.get('/uji', () => { throw new Error('RAHASIA_INTERNAL_TEST'); });
  mini.use(errorHandler);
  const listener = mini.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${listener.address().port}/uji`);
    const text = await response.text();
    assert.equal(response.status, 500);
    assert.equal(JSON.parse(text).error.kode, 'INTERNAL_ERROR');
    assert.doesNotMatch(text, /RAHASIA_INTERNAL_TEST|stack/i);
  } finally {
    listener.close();
  }
});
