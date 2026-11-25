import { AppError } from '../utils/AppError.js';

// status default 400 agar endpoint ETS lama tidak berubah; endpoint auth memakai 422.
export function validate(schema, bagian = 'body', status = 400) {
  return (req, res, next) => {
    // Joi.object() menerima undefined jika objeknya sendiri tidak diberi .required().
    // Body yang tidak dibaca (misalnya Content-Type bukan JSON) harus menjadi 400,
    // bukan diteruskan sebagai undefined hingga Prisma mengembalikan 500.
    if (bagian === 'body' && req.body === undefined) {
      return next(new AppError(status, 'Body JSON wajib diisi (Content-Type: application/json)', 'VALIDATION_ERROR'));
    }
    const { value, error } = schema.validate(req[bagian], {
      abortEarly: false,
      allowUnknown: false,
      convert: bagian === 'params' || bagian === 'query',
    });
    if (error) return next(new AppError(status, error.details.map((detail) => detail.message).join('; '), 'VALIDATION_ERROR'));
    // Express 5: req.query merupakan getter, jadi simpan hasil terverifikasi di res.locals.
    res.locals[bagian] = value;
    next();
  };
}
