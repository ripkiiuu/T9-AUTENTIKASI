import Joi from 'joi';

// Hanya email dan password yang diterima. Field lain (mis. role) ditolak Joi.
export const skemaAuth = Joi.object({
  email: Joi.string().email().max(100).required(),
  // bcrypt membatasi 72 BYTE, bukan 72 karakter; emoji/Unicode bisa melebihi batas lebih cepat.
  password: Joi.string().min(8).max(72).custom((value, helpers) => {
    if (Buffer.byteLength(value, 'utf8') > 72) return helpers.error('any.invalid');
    return value;
  }).required(),
});
