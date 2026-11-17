export function GET() {
  if (process.env.SCF_DEMO_MODE !== 'true') return new Response(null, { status: 404 });
  return Response.json({ status: 'ok', mode: 'synthetic-demo', highAvailability: false });
}
