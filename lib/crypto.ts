import { runtime } from './storage';
import { PublicError } from './errors';
const encode=new TextEncoder();
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unbase64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const base64url=(s:string|Uint8Array)=>base64(typeof s==='string'?encode.encode(s):s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function key(){const secret=runtime().KEY_ENCRYPTION_SECRET;if(!secret||secret.length<32)throw new PublicError('보안 저장소가 준비되지 않았습니다. 관리자에게 문의하세요.',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encode.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function encrypt(data:unknown,owner:string){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(owner)},await key(),encode.encode(JSON.stringify(data)));return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;}
export async function decrypt<T>(s:string,owner:string):Promise<T>{const [iv,body]=s.split('.');const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(iv),additionalData:encode.encode(owner)},await key(),unbase64(body));return JSON.parse(new TextDecoder().decode(data)) as T;}
export async function hmac(secret:string,message:string,hash='SHA-256'){const signing=await crypto.subtle.importKey('raw',encode.encode(secret),{name:'HMAC',hash},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',signing,encode.encode(message)));}
export const hex=(bytes:Uint8Array)=>Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
