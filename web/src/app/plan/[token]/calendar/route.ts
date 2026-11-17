import { getSharedPlan } from '@/lib/api';
import { icsFileName, planToIcs } from '@/lib/calendar';

type Context = { params: Promise<{ token: string }> };

/** The shared plan as a calendar file (#227); stops working as soon as the owner stops sharing. */
export async function GET(_request: Request, { params }: Context) {
  const plan = await getSharedPlan((await params).token);
  if (!plan) return new Response('This plan isn’t shared.', { status: 404 });
  return new Response(planToIcs(plan), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFileName(plan.title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
