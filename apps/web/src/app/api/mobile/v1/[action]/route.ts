import { handleMobileGateway } from '../../../../../lib/mobile-gateway';

type Context = { params: Promise<{ action: string }> };

async function handle(request: Request, { params }: Context): Promise<Response> {
  return handleMobileGateway(request, (await params).action, process.env);
}

export const GET = handle;
export const POST = handle;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
