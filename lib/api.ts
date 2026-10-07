import { getChatGPTUser } from '../app/chatgpt-auth';
import { PublicError } from './errors';
export class HttpError extends PublicError {}
export async function identity(request:Request,write=false){if(write)checkOrigin(request);const user=await getChatGPTUser();if(!user)throw new HttpError('로그인 후 이용할 수 있습니다.',401);return user.userId;}
export function checkOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError('허용되지 않은 요청입니다.',403);const fetchSite=request.headers.get('sec-fetch-site');if(fetchSite==='cross-site')throw new HttpError('허용되지 않은 요청입니다.',403);}
export function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
export async function handle(fn:()=>Promise<unknown>){try{return response(await fn());}catch(e){if(e instanceof PublicError)return response({error:e.message},e.status);console.error('Coinfolio request failed:',e instanceof Error?e.name:'UnknownError');return response({error:'요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.'},500);}}
export async function body<T>(request:Request):Promise<T>{const raw=await request.text();if(raw.length>8192)throw new HttpError('입력 내용이 너무 깁니다.',413);try{return JSON.parse(raw) as T;}catch{throw new HttpError('올바른 입력 형식이 아닙니다.');}}
