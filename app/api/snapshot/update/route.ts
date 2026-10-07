import { checkOrigin, handle } from '../../../../lib/api';
import { runDaily } from '../../../../lib/service';
// This shared writer relies on the owner-private Sites dispatch access boundary.
// Dispatch consumes OAI-Sites-Authorization for unattended requests. No user financial data is returned.
export async function POST(request:Request){return handle(async()=>{checkOrigin(request);return runDaily();});}
