import { prisma } from '../lib/prisma.js';

// Dipakai khusus login: hash diperlukan untuk bcrypt.compare, tidak pernah dikirim ke client.
export function cariByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

export function simpan({ email, passwordHash }) {
  return prisma.user.create({
    data: { email, passwordHash },
    // passwordHash sengaja tidak dipilih agar tidak pernah ikut pada respons register.
    select: { id: true, email: true },
  });
}
