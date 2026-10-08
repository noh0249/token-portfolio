export type BinanceStage = 'time' | 'account' | 'earn';

const explanations: Record<number, string> = {
  [-2014]: '바이낸스 API Key 형식이 올바르지 않습니다. 시스템 생성 HMAC 키인지 확인하세요.',
  [-2015]: '바이낸스가 API 키 인증을 거부했습니다. 키의 활성 상태, 잔고 조회 권한과 허용 IP를 확인하세요.',
  [-1022]: '바이낸스 서명이 일치하지 않습니다. 동일한 HMAC API Key와 Secret Key 조합인지 확인하세요.',
  [-1021]: '바이낸스 요청 시간이 허용 범위를 벗어났습니다. 잠시 후 다시 동기화하세요.',
  [-1003]: '바이낸스 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
};

export async function binanceErrorCode(response: Response): Promise<number | null> {
  let code: number | null = null;
  try {
    const text = await response.text();
    if (text.length <= 4096) {
      const body = JSON.parse(text) as { code?: unknown } | null;
      if (typeof body?.code === 'number' && Number.isInteger(body.code) && body.code < 0 && body.code >= -99999) code = body.code;
    }
  } catch { /* HTML WAF responses have no exchange error code. */ }
  return code;
}

// Never reflect provider messages, headers, URLs or response bodies to the browser or logs.
export async function binanceFailure(response: Response, stage: BinanceStage): Promise<string> {
  const code = await binanceErrorCode(response);
  const status = response.status;
  console.warn('Coinfolio provider failure', JSON.stringify({ provider: 'binance', stage, status, code }));
  let message = code === null ? undefined : explanations[code];
  if (!message) {
    if (status === 451) message = '현재 조회 서버 지역에서 바이낸스 접근이 제한됩니다. 조회 서버의 배포 지역을 확인해야 합니다.';
    else if (status === 418 || status === 429) message = explanations[-1003];
    else if (stage === 'time' && (status === 401 || status === 403)) message = '바이낸스가 API 키 없이 호출한 서버 시간 조회를 차단했습니다. 조회 서버의 접근 제한을 확인해야 합니다.';
    else if (status === 403) message = '바이낸스 방화벽이 잔고 조회 요청을 차단했습니다. 조회 서버의 접근 제한을 확인해야 합니다.';
    else if (status === 401) message = '바이낸스 인증 요청이 거부됐습니다. HMAC API Key와 Secret Key의 조합을 확인하세요.';
    else message = '바이낸스 잔고 조회에 실패했습니다. 잠시 후 다시 동기화하세요.';
  }
  return `${message} [Binance ${stage} · HTTP ${status}${code === null ? '' : ` · ${code}`}]`;
}

// Official Binance Spot REST origins. Credentials are never used for availability checks.
const origins = ['https://api-gcp.binance.com', 'https://api.binance.com', 'https://api1.binance.com'] as const;
type Endpoint = { baseUrl: string; serverTime: number } | { error: string };

export function binanceTransportFailure(cause: unknown, stage: BinanceStage): string {
  const detail = cause instanceof Error ? cause.message : '';
  const kind = /redirect/i.test(detail) ? 'redirect' : /timeout|abort/i.test(detail) ? 'timeout' : /dns|resolve/i.test(detail) ? 'dns' : 'connection';
  console.warn('Coinfolio provider transport failure', JSON.stringify({ provider: 'binance', stage, kind }));
  return `네트워크 연결에 실패했습니다. 잠시 후 다시 동기화하세요. [Binance ${stage} · network: ${kind}]`;
}

export async function binanceEndpoint(fetcher: typeof fetch = fetch): Promise<Endpoint> {
  let error = '네트워크 연결에 실패했습니다. 잠시 후 다시 동기화하세요.';
  for (const baseUrl of origins) {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}/api/v3/time`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    } catch (cause) { error = binanceTransportFailure(cause, 'time'); continue; }
    if (response.ok) {
      try {
        const data = await response.json() as { serverTime?: unknown };
        if (typeof data.serverTime === 'number' && Number.isSafeInteger(data.serverTime) && data.serverTime > 0) {
          return { baseUrl, serverTime: data.serverTime };
        }
      } catch { /* An invalid time response must never be used to sign a request. */ }
      return { error: '바이낸스 서버 시간 응답이 올바르지 않습니다. 잠시 후 다시 동기화하세요.' };
    }
    const code = await binanceErrorCode(response.clone());
    error = await binanceFailure(response, 'time');
    // Stop on rate limits, authentication failures and geographic restrictions.
    // Only public WAF or upstream availability failures may try another official origin.
    if (response.headers.has('Retry-After') || code === -1003 || ![403, 500, 502, 503, 504].includes(response.status)) {
      return { error };
    }
  }
  return { error };
}
