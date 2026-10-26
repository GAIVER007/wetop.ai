import { handleMobileFoodGateway } from '../../../../../../lib/mobile-food-gateway';

type Context = { params: Promise<{ action: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  return handleMobileFoodGateway(request, (await params).action, process.env);
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  return handleMobileFoodGateway(request, (await params).action, process.env);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
