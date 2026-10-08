import { database } from './storage';
import { safeImageUrl } from './wallet-data';
import { PublicError } from './errors';

type Cache={assets:{id?:string;kind?:string;name:string;image?:boolean}[];media?:Record<string,string>};
async function cache(userId:string):Promise<Cache|null>{const row=await database().prepare('SELECT payload FROM portfolios WHERE user_id = ?').bind(userId).first<{payload:string}>();return row?JSON.parse(row.payload) as Cache:null;}
export async function setBrand(userId:string,id:string|null){
 if(id!==null){const asset=(await cache(userId))?.assets.find(a=>a.id===id&&a.kind==='nft'&&a.image);if(!asset)throw new PublicError('현재 보유 중이며 이미지가 있는 NFT를 선택하세요.');}
 await database().prepare('INSERT INTO nft_preferences (user_id,brand_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET brand_id = excluded.brand_id').bind(userId,id).run();
}
export async function imageResponse(userId:string,id:string):Promise<Response>{
 if(!/^a_[a-f0-9]{32}$/.test(id))throw new PublicError('이미지를 찾을 수 없습니다.',404);
 const url=safeImageUrl((await cache(userId))?.media?.[id]);if(!url)throw new PublicError('이미지를 찾을 수 없습니다.',404);
 let response:Response;try{response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});}catch{throw new PublicError('이미지를 불러올 수 없습니다.',502);}
 const type=response.headers.get('content-type')?.split(';')[0].toLowerCase();
 if(!response.ok||!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(type??'')||Number(response.headers.get('content-length'))>4*1024*1024)throw new PublicError('이미지를 불러올 수 없습니다.',502);
 const reader=response.body?.getReader();if(!reader)throw new PublicError('이미지를 불러올 수 없습니다.',502);
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();throw new PublicError('이미지 크기가 너무 큽니다.',413);}chunks.push(value);}}catch(e){if(e instanceof PublicError)throw e;throw new PublicError('이미지를 불러올 수 없습니다.',502);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return new Response(bytes,{headers:{'Content-Type':type!,'Cache-Control':'private, max-age=1800','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
