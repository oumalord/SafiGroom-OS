import { createHash } from 'node:crypto';
import { handler as apiRouter } from '../backend/index.ts';
import { db, withRequestContext } from '../backend/runtime.ts';

const publicRoutes = new Set([
  '/api/_healthcheck',
  '/api/public/salons',
  '/api/public/branches',
  '/api/public/review-appointments',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/public/reviews',
  '/api/mpesa/callback',
  '/api/payroll/timeout',
  '/api/payroll/result',
  '/api/paystack/webhook',
]);

export const config = { api: { bodyParser: false } };

function normalizeRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  if (['owner', 'manager', 'receptionist', 'barber', 'customer', 'admin'].includes(value)) return value;
  if (value.includes('reception')) return 'receptionist';
  if (value.includes('manager')) return 'manager';
  return 'barber';
}

function headerValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

async function resolveContext(request: any) {
  const authorization = headerValue(request.headers?.authorization);
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [session] = await db.get('sessions', [tokenHash]);
  if (!session || session.expiresAt < Date.now()) return null;
  const [account] = await db.get('accounts', [session.accountId]);
  if (!account || account.status !== 'active') return null;

  let branchId = account.branchId;
  const requestedBranchId = headerValue(request.headers?.['x-branch-id']);
  const role = normalizeRole(account.role);
  if ((role === 'owner' || role === 'manager') && requestedBranchId) {
    const [branch] = await db.get('branches', [requestedBranchId]);
    if (branch && branch.salonId === account.tenantId && branch.status === 'active') branchId = branch.id;
  }

  return {
    accountId: account.id,
    tenantId: account.tenantId,
    salonName: account.salonName,
    branchId,
    role,
    name: account.name,
    mustChangePin: Boolean(account.staffId && role !== 'receptionist' && (account.mustChangePin || !account.pinChangedAt)),
  };
}

export default async function apiRoute(request: any, response: any) {
  const method = String(request.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return response.status(204).end();

  const incomingQuery = request.query && typeof request.query === 'object' ? request.query : {};
  const pathFromRewrite = headerValue(incomingQuery.__path).replace(/^\/+|\/+$/g, '');
  if (!pathFromRewrite) return response.status(404).json({ error: 'API route not found' });

  const pathname = `/api/${pathFromRewrite}`;
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(incomingQuery)) {
    if (key === '__path') continue;
    query[key] = Array.isArray(value) ? value.map(String).join(',') : String(value ?? '');
  }

  let rawBody = Buffer.alloc(0);
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 4 * 1024 * 1024) return response.status(413).json({ error: 'Request body is too large.' });
      chunks.push(buffer);
    }
    rawBody = Buffer.concat(chunks);
  }
  let requestBody: any = {};
  if (rawBody.length) {
    try {
      requestBody = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
  }

  for (const [definition, [routeHandler]] of Object.entries(apiRouter.routes)) {
    const [routeMethod, routePath] = definition.split(' ');
    if (routeMethod !== method) continue;

    const pattern = new RegExp(`^${routePath.replace(/:[^/]+/g, '([^/]+)')}$`);
    const match = pathname.match(pattern);
    if (!match) continue;

    const parameterNames = [...routePath.matchAll(/:([^/]+)/g)].map(result => result[1]);
    const params = Object.fromEntries(parameterNames.map((name, index) => [name, decodeURIComponent(match[index + 1])]));

    try {
      const context = await resolveContext(request);
      if (!publicRoutes.has(pathname) && !context) return response.status(401).json({ error: 'Please log in.' });
      if (context?.mustChangePin && pathname !== '/api/auth/change-pin') return response.status(403).json({ error: 'Change your staff PIN before using the portal.', code: 'PIN_CHANGE_REQUIRED' });

      const result = await withRequestContext(context, () => routeHandler({ body: requestBody, query, params, headers: request.headers, rawBody }));
      return response.status(result?.status || 200).json(result?.body ?? result);
    } catch (cause) {
      console.error(cause);
      return response.status(500).json({ error: 'Internal server error' });
    }
  }

  return response.status(404).json({ error: 'API route not found' });
}
