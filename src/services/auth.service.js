import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as data from '../data/user.data.js';
import { AppError } from '../utils/AppError.js';

export async function register({ email, password }) {
  if (await data.cariByEmail(email)) {
    throw new AppError(409, 'Email sudah terdaftar', 'EMAIL_DUPLIKAT');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await data.simpan({ email, passwordHash });
  } catch (err) {
    // Dua register bersamaan dapat lolos cek awal; unique index tetap menjadi pengaman terakhir.
    if (err.code === 'P2002') {
      throw new AppError(409, 'Email sudah terdaftar', 'EMAIL_DUPLIKAT');
    }
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await data.cariByEmail(email);

  // bcrypt.compare bersifat async. Tanpa await, Promise yang truthy membuat semua password lolos.
  const cocok = Boolean(user) && (await bcrypt.compare(password, user.passwordHash));

  // Email tidak terdaftar dan password salah sengaja memakai pesan/kode yang sama.
  if (!cocok) {
    throw new AppError(401, 'Email atau password salah', 'LOGIN_GAGAL');
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  return { token };
}
