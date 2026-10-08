import { body, handle, identity } from '../../../lib/api';
import { setProfile } from '../../../lib/service';
import { setBrand } from '../../../lib/asset-media';
import { saveNftKey } from '../../../lib/wallet-assets';
import { HttpError } from '../../../lib/api';
export async function POST(request:Request){return handle(async()=>{const id=await identity(request,true),input=await body<{profile?:string;brandId?:string|null;openSeaKey?:string}>(request);if(!input||typeof input!=='object')throw new HttpError('올바른 입력 형식이 아닙니다.');if(input.profile!==undefined)await setProfile(id,input.profile);else if(input.brandId!==undefined)await setBrand(id,input.brandId);else if(input.openSeaKey!==undefined)await saveNftKey(id,input.openSeaKey);else throw new HttpError('올바른 입력 형식이 아닙니다.');return {ok:true};});}
