/*
 * Server local: phục vụ giao diện web + chuyển lệnh xuống 2 ESP32 qua Blynk Cloud HTTP API.
 * Virtual pins khớp core.cpp: V0 reset, V1..V20 chọn Z, V100 ion, V102 nam châm.
 */
require('dotenv').config();
const os = require('os');
const path = require('path');
const express = require('express');

const PORT = Number(process.env.PORT) || 3000;
const BLYNK_SERVER = process.env.BLYNK_SERVER || 'blynk.cloud';
const MOCK = process.env.MOCK === '1';
const MAGNET_BOARD = process.env.MAGNET_BOARD === 'metal' ? 'metal' : 'nonmetal';
const TOKENS = {
  metal: process.env.TOKEN_METAL || '',
  nonmetal: process.env.TOKEN_NONMETAL || '',
};

const PIN_RESET = 0;
const PIN_ION = 100;
const PIN_MAGNET = 102;

// Mỗi mô hình chỉ được phép chọn đúng nhóm nguyên tố của nó
const ALLOWED_Z = {
  metal: [3, 11, 12, 13, 19, 20],      // Li, Na, Mg, Al, K, Ca
  nonmetal: [1, 7, 8, 9, 15, 16, 17],  // H, N, O, F, P, S, Cl
};

const isMock = (model) => MOCK || !TOKENS[model];

async function blynkRequest(model, endpoint, params = {}) {
  const url = new URL(`https://${BLYNK_SERVER}/external/api/${endpoint}`);
  url.searchParams.set('token', TOKENS[model]);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  // Lần kết nối đầu (DNS/TLS lạnh) có thể chậm -> thử lại 1 lần khi lỗi mạng
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      break;
    } catch (err) {
      if (attempt >= 2) throw new Error(`Không kết nối được Blynk: ${err.message}`);
      console.warn(`[BLYNK] ${model} lỗi mạng (${err.message}), thử lại...`);
    }
  }
  const body = await res.text();
  if (!res.ok) throw new Error(`Blynk ${res.status}: ${body || res.statusText}`);
  return body;
}

async function writePin(model, pin, value) {
  if (isMock(model)) {
    console.log(`[MOCK] ${model} V${pin}=${value}`);
    return;
  }
  await blynkRequest(model, 'update', { [`V${pin}`]: value });
  console.log(`[BLYNK] ${model} V${pin}=${value}`);
}

// Firmware chỉ phản ứng khi nhận 1 -> gửi 1 rồi nhả về 0 như nút push
async function pushPin(model, pin) {
  await writePin(model, pin, 1);
  await writePin(model, pin, 0);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (!res.headersSent) res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
};

function requireModel(req, res) {
  const { model } = req.params;
  if (!ALLOWED_Z[model]) {
    res.status(400).json({ ok: false, error: `Mô hình không hợp lệ: ${model}` });
    return null;
  }
  return model;
}

app.post('/api/:model/select', handle(async (req, res) => {
  const model = requireModel(req, res);
  if (!model) return;
  const z = Number(req.body?.z);
  if (!ALLOWED_Z[model].includes(z)) {
    res.status(400).json({ ok: false, error: `Z=${req.body?.z} không thuộc nhóm ${model}` });
    return;
  }
  await pushPin(model, z);
  return { mock: isMock(model) };
}));

app.post('/api/:model/ion', handle(async (req, res) => {
  const model = requireModel(req, res);
  if (!model) return;
  await pushPin(model, PIN_ION);
  return { mock: isMock(model) };
}));

app.post('/api/:model/reset', handle(async (req, res) => {
  const model = requireModel(req, res);
  if (!model) return;
  await pushPin(model, PIN_RESET);
  return { mock: isMock(model) };
}));

app.post('/api/magnet', handle(async (req) => {
  const on = req.body?.on ? 1 : 0;
  await writePin(MAGNET_BOARD, PIN_MAGNET, on);
  return { on: !!on, mock: isMock(MAGNET_BOARD) };
}));

app.post('/api/bond', handle(async () => {
  await Promise.all([pushPin('metal', PIN_ION), pushPin('nonmetal', PIN_ION)]);
  await writePin(MAGNET_BOARD, PIN_MAGNET, 1);
  return { magnet: true };
}));

app.get('/api/status', handle(async () => {
  const check = async (model) => {
    if (isMock(model)) return { online: false, mock: true };
    try {
      const body = await blynkRequest(model, 'isHardwareConnected');
      return { online: body.trim() === 'true', mock: false };
    } catch (err) {
      return { online: false, mock: false, error: err.message };
    }
  };
  const [metal, nonmetal] = await Promise.all([check('metal'), check('nonmetal')]);
  return { metal, nonmetal };
}));

app.listen(PORT, () => {
  console.log(`Mô hình nguyên tử web: http://localhost:${PORT}`);
  // Địa chỉ LAN để mở trên điện thoại/tablet cùng mạng WiFi
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`  Điện thoại/tablet: http://${net.address}:${PORT}`);
    }
  }
  for (const model of ['metal', 'nonmetal']) {
    console.log(`  ${model.padEnd(8)} -> ${isMock(model) ? 'MOCK (không gửi phần cứng)' : `Blynk ${BLYNK_SERVER}`}`);
  }
});
