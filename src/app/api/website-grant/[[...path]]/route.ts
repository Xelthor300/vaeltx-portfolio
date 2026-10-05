export function GET() { return Response.json({ error: 'This campaign has ended. Visit /website-auction.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } }); }
export const POST = GET;
