import { Router } from 'express';
import * as ctrl from '../controllers/product.controller.js';
import { validate } from '../middleware/validate.js';
import { butuhLogin } from '../middleware/auth.js';
import { productBody, productId, productQuery } from '../validators/product.validator.js';

const router = Router();

// Publik: siapa pun boleh membaca daftar dan detail produk.
router.get('/', validate(productQuery, 'query'), ctrl.daftar);
router.get('/:id', validate(productId, 'params'), ctrl.detail);

// Wajib login: aksi yang mengubah data. Urutan tetap butuhLogin -> validasi -> controller.
router.post('/', butuhLogin, validate(productBody), ctrl.buat);
router.put('/:id', butuhLogin, validate(productId, 'params'), validate(productBody), ctrl.perbarui);
router.delete('/:id', butuhLogin, validate(productId, 'params'), ctrl.hapus);

export default router;
