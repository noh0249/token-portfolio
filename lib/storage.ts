import { env } from 'cloudflare:workers';
export function database():D1Database { if(!env.DB)throw new Error('기록 저장소를 사용할 수 없습니다. 잠시 후 다시 시도하세요.');return env.DB; }
export function runtime(){ return env as Cloudflare.Env; }
