// Backend mínimo del asesor con IA de PLAGA ZOMBIE: Manabí.
// Recibe el estado de la partida y pide un consejo a un modelo Claude en Amazon Bedrock.
// Las credenciales de AWS se leen del entorno o del perfil de AWS (nunca del frontend).
import { createServer } from 'node:http';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { CHARACTER_IDS, buildSystemPrompt, buildUserPrompt, extractAdvice, sanitizeState } from './advice-core.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
// En algunas regiones hay que usar un perfil de inferencia, por ejemplo "us.anthropic.claude-opus-5-5"
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-opus-5-5';
const MAX_TOKENS = Number(process.env.BEDROCK_MAX_TOKENS ?? 16000);
const TIMEOUT_MS = Number(process.env.BEDROCK_TIMEOUT_MS ?? 25000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000';
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);

// El SDK usa la cadena de credenciales por defecto: variables de entorno
// (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN), AWS_PROFILE, SSO, rol de la instancia, etc.
const client = new BedrockRuntimeClient({ region: REGION });

// Límite simple por IP para no disparar costos por accidente
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Solicitud demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function askBedrock(character, state) {
  const command = new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: buildSystemPrompt(character, state.mode) }],
    messages: [{ role: 'user', content: [{ text: buildUserPrompt(state) }] }],
    inferenceConfig: { maxTokens: MAX_TOKENS }
  });
  const response = await client.send(command, { abortSignal: AbortSignal.timeout(TIMEOUT_MS) });
  return extractAdvice(response);
}

/** Traduce errores del SDK a un código HTTP y un mensaje corto (sin detalles internos). */
function describeError(err) {
  const name = err?.name ?? '';
  if (name === 'CredentialsProviderError' || /credential/i.test(err?.message ?? '')) {
    return { status: 503, error: 'Bedrock no está configurado: faltan credenciales de AWS.' };
  }
  if (name === 'AccessDeniedException') return { status: 503, error: 'La cuenta de AWS no tiene acceso a este modelo en Bedrock.' };
  if (name === 'ResourceNotFoundException' || name === 'ValidationException') {
    return { status: 502, error: `Bedrock rechazó la solicitud (${name}). Revisa BEDROCK_MODEL_ID y la región.` };
  }
  if (name === 'ThrottlingException') return { status: 429, error: 'Bedrock está limitando las solicitudes. Intenta en un momento.' };
  if (name === 'TimeoutError' || name === 'AbortError') return { status: 504, error: 'Bedrock tardó demasiado en responder.' };
  return { status: err?.status ?? 502, error: err?.status ? err.message : 'No se pudo obtener el consejo.' };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, model: MODEL_ID, region: REGION });
  }

  if (req.method === 'POST' && url.pathname === '/api/advice') {
    const ip = req.socket.remoteAddress ?? 'desconocida';
    if (rateLimited(ip)) return send(res, 429, { error: 'Demasiadas solicitudes. Espera un minuto.' });
    try {
      const body = await readJson(req);
      if (!CHARACTER_IDS.includes(body.character)) return send(res, 400, { error: 'Personaje desconocido' });
      const state = sanitizeState(body.state);
      const advice = await askBedrock(body.character, state);
      return send(res, 200, { advice, source: 'bedrock', model: MODEL_ID });
    } catch (err) {
      const { status, error } = describeError(err);
      console.error(`[asesor] ${status} ${err?.name ?? ''}: ${err?.message ?? err}`);
      return send(res, status, { error });
    }
  }

  send(res, 404, { error: 'No encontrado' });
});

server.listen(PORT, () => {
  console.log(`Asesor IA escuchando en http://localhost:${PORT}`);
  console.log(`Modelo: ${MODEL_ID} · Región: ${REGION}`);
});
