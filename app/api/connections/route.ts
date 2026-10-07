import { body, handle, HttpError, identity } from '../../../lib/api';
import { addConnection, removeConnection } from '../../../lib/service';
export async function POST(request:Request){return handle(async()=>{const id=await identity(request,true);return addConnection(id,await body(request));});}
export async function DELETE(request:Request){return handle(async()=>{const user=await identity(request,true),id=new URL(request.url).searchParams.get('id');if(!id)throw new HttpError('연결 ID가 필요합니다.');await removeConnection(user,id);return {ok:true};});}
