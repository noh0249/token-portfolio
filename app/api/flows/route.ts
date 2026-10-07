import { body, handle, identity } from '../../../lib/api';
import { setFlow } from '../../../lib/service';
export async function POST(request:Request){return handle(async()=>{const id=await identity(request,true),input=await body<{day:string;amount:number}>(request);await setFlow(id,input.day,input.amount);return {ok:true};});}
