import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

// Autentikasi: memastikan request membawa token yang sah.
// Error dikirim lewat next(new AppError(...)) agar formatnya seragam dari errorHandler.
export function butuhLogin(req, res, next) {
  const header = req.headers.authorization; // contoh: "Bearer eyJhbGciOi..."

  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Token diperlukan', 'TOKEN_DIPERLUKAN'));
  }

  try {
    // jwt.verify memeriksa signature dan exp. Jangan memakai jwt.decode untuk keputusan akses.
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET); // { id, iat, exp }
    next();
  } catch (err) {
    next(new AppError(401, 'Token tidak valid atau expired', 'TOKEN_TIDAK_VALID'));
  }
}
