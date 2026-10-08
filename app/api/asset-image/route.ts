import { handle, identity } from '../../../lib/api';
import { imageResponse } from '../../../lib/asset-media';
export async function GET(request:Request){try{return await imageResponse(await identity(request),new URL(request.url).searchParams.get('id')??'');}catch(e){return handle(async()=>{throw e;});}}
