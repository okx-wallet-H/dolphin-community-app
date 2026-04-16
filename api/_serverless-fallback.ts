import type { VercelRequest, VercelResponse } from '@vercel/node';

export function setOpenCors(res: VercelResponse, req?: VercelRequest) {
  const origin = typeof req?.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function handlePreflight(req: VercelRequest, res: VercelResponse) {
  setOpenCors(res, req);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function sendMethodNotAllowed(res: VercelResponse) {
  return res.status(405).json({
    code: '405',
    msg: 'METHOD_NOT_ALLOWED',
    success: false,
    error: 'METHOD_NOT_ALLOWED',
  });
}

export function sendServerlessUnavailable(
  res: VercelResponse,
  options: {
    route: string;
    feature: string;
    requiredEnv?: string[];
  },
) {
  return res.status(503).json({
    code: '503',
    msg: `${options.feature} is temporarily unavailable in this standalone serverless deployment`,
    success: false,
    error: 'SERVERLESS_ROUTE_NOT_CONFIGURED',
    route: options.route,
    feature: options.feature,
    requiredEnv: options.requiredEnv ?? [],
  });
}
