import { handle } from '../../../../lib/api';
import { dailyStatus } from '../../../../lib/service';
export const dynamic='force-dynamic';
export async function GET(){return handle(async()=>dailyStatus());}
