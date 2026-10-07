import { handle, identity } from '../../../lib/api';
import { getPortfolio } from '../../../lib/service';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handle(async()=>getPortfolio(await identity(request)));}
