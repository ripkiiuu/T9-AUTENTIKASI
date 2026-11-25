import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { butuhLogin } from '../middleware/auth.js';
import { skemaAuth } from '../validators/auth.validator.js';

const router = Router();

// Validasi input auth memakai 422 sesuai ketentuan Tugas 9.
router.post('/register', validate(skemaAuth, 'body', 422), ctrl.register);
router.post('/login', validate(skemaAuth, 'body', 422), ctrl.login);
router.get('/saya', butuhLogin, ctrl.saya);

export default router;
