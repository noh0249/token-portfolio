import { handle, identity } from '../../../lib/api';
import { syncPortfolio } from '../../../lib/service';
export async function POST(request:Request){return handle(async()=>syncPortfolio(await identity(request,true)));}
