import { body, handle, identity } from '../../../lib/api';
import { setProfile } from '../../../lib/service';
export async function POST(request:Request){return handle(async()=>{const id=await identity(request,true),input=await body<{profile:string}>(request);await setProfile(id,input.profile);return {ok:true};});}
