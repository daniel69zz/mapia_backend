const crypto = require('crypto');
const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PEPPER = process.env.OTP_PEPPER || 'mapia-dev-otp-pepper';
const DEVELOPMENT_OTP = '123456';

const users = new Map();
const sessions = new Map();
const posts = [];

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    phoneVerified: user.phoneVerified,
    canPublish: user.phoneVerified,
  };
}

function hash(value) {
  return crypto.createHash('sha256').update(`${value}:${OTP_PEPPER}`).digest('hex');
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function isValidPhone(phone) {
  return /^\+?[0-9 ]{7,15}$/.test(phone);
}

function requireAuth(req, res) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  const userId = sessions.get(token);
  const user = userId ? users.get(userId) : null;

  if (!user) {
    json(res, 401, { message: 'No autenticado.' });
    return null;
  }

  return user;
}

async function register(req, res) {
  const body = await parseBody(req);
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const phone = normalizePhone(body.phone);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!firstName || !lastName || !phone || !email || !password) {
    json(res, 400, { message: 'Nombre, apellido, telefono, email y contrasena son obligatorios.' });
    return;
  }
  if (!isValidPhone(phone)) {
    json(res, 400, { message: 'Telefono invalido.' });
    return;
  }
  if (!email.includes('@')) {
    json(res, 400, { message: 'Email invalido.' });
    return;
  }
  if (password.length < 6) {
    json(res, 400, { message: 'La contrasena debe tener al menos 6 caracteres.' });
    return;
  }
  if ([...users.values()].some((user) => user.email === email)) {
    json(res, 409, { message: 'Ya existe un usuario con ese email.' });
    return;
  }

  const id = crypto.randomUUID();
  const user = {
    id,
    firstName,
    lastName,
    phone,
    email,
    passwordHash: hash(password),
    phoneVerified: false,
    otp: null,
  };
  users.set(id, user);

  const token = createToken();
  sessions.set(token, id);
  json(res, 201, { token, user: publicUser(user) });
}

async function updateMe(req, res, user) {
  const body = await parseBody(req);
  const firstName = body.firstName === undefined ? user.firstName : String(body.firstName).trim();
  const lastName = body.lastName === undefined ? user.lastName : String(body.lastName).trim();
  const nextPhone = body.phone === undefined ? user.phone : normalizePhone(body.phone);

  if (!firstName || !lastName || !nextPhone) {
    json(res, 400, { message: 'Nombre, apellido y telefono son obligatorios.' });
    return;
  }
  if (!isValidPhone(nextPhone)) {
    json(res, 400, { message: 'Telefono invalido.' });
    return;
  }

  const phoneChanged = user.phone !== nextPhone;
  user.firstName = firstName;
  user.lastName = lastName;
  user.phone = nextPhone;
  if (phoneChanged) {
    user.phoneVerified = false;
    user.otp = null;
  }

  json(res, 200, { user: publicUser(user) });
}

function sendPhoneCode(res, user) {
  const code = DEVELOPMENT_OTP;
  user.otp = {
    codeHash: hash(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  json(res, 200, {
    message: 'Codigo enviado.',
    developmentCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
}

async function verifyPhoneCode(req, res, user) {
  const body = await parseBody(req);
  const code = String(body.code || '').trim();
  if (code === DEVELOPMENT_OTP) {
    user.phoneVerified = true;
    user.otp = null;
    json(res, 200, { user: publicUser(user) });
    return;
  }
  const otp = user.otp;

  if (!otp || Date.now() > otp.expiresAt) {
    json(res, 400, { message: 'Codigo expirado.' });
    return;
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    json(res, 429, { message: 'Demasiados intentos.' });
    return;
  }

  otp.attempts += 1;
  if (hash(code) !== otp.codeHash) {
    json(res, 400, { message: 'Codigo invalido.' });
    return;
  }

  user.phoneVerified = true;
  user.otp = null;
  json(res, 200, { user: publicUser(user) });
}

async function createPost(req, res, user) {
  if (!user.phoneVerified) {
    json(res, 403, { message: 'Debes verificar tu numero de celular antes de publicar.' });
    return;
  }

  const body = await parseBody(req);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();

  if (!title || !description) {
    json(res, 400, { message: 'Titulo y descripcion son obligatorios.' });
    return;
  }

  const post = {
    id: crypto.randomUUID(),
    userId: user.id,
    title,
    description,
    type: body.type || 'novelty',
    createdAt: new Date().toISOString(),
  };
  posts.push(post);
  json(res, 201, { post });
}

const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;
    const path = new URL(url, `http://${req.headers.host}`).pathname;

    if (method === 'POST' && path === '/auth/register') {
      await register(req, res);
      return;
    }

    const user = requireAuth(req, res);
    if (!user) return;

    if (method === 'GET' && path === '/users/me') {
      json(res, 200, { user: publicUser(user) });
      return;
    }
    if (method === 'PATCH' && path === '/users/me') {
      await updateMe(req, res, user);
      return;
    }
    if (method === 'POST' && path === '/users/phone/send-code') {
      sendPhoneCode(res, user);
      return;
    }
    if (method === 'POST' && path === '/users/phone/verify-code') {
      await verifyPhoneCode(req, res, user);
      return;
    }
    if (method === 'POST' && path === '/posts') {
      await createPost(req, res, user);
      return;
    }
    if (method === 'GET' && path === '/posts') {
      json(res, 200, { posts });
      return;
    }

    json(res, 404, { message: 'Ruta no encontrada.' });
  } catch (error) {
    json(res, 500, { message: error.message || 'Error interno.' });
  }
});

server.listen(PORT, () => {
  console.log(`Mapia backend listening on http://localhost:${PORT}`);
});
