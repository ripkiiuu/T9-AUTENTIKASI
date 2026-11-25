import { Router } from 'express';
import * as ctrl from '../controllers/order.controller.js';
import { validate } from '../middleware/validate.js';
import { butuhLogin } from '../middleware/auth.js';
import { orderBody } from '../validators/order.validator.js';

const router = Router();

// Publik: daftar order beserta produk (include).
router.get('/', ctrl.daftar);

// Wajib login: transaksi dua tabel (orders + products).
router.post('/', butuhLogin, validate(orderBody), ctrl.buat);

export default router;
