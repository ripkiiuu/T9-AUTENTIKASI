import * as service from '../services/auth.service.js';

export async function register(req, res) {
  const user = await service.register(res.locals.body);
  res.status(201).json({ data: user });
}

export async function login(req, res) {
  const hasil = await service.login(res.locals.body);
  res.json({ data: hasil });
}

export function saya(req, res) {
  res.json({ data: req.user });
}
