import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Route } from '@/components/route';
import { SiteFooter } from '@/components/site-footer';
import { AccountMenu } from '@/components/account-menu';
import { SiteHeader } from '@/components/site-header';
import { getSharedPlan, hasSavedPlan, SessionExpiredError } from '@/lib/api';
import { formatEuros, formatKm } from '@/lib/format';
import { describeWhen, toRouteStops } from '@/lib/plan';
import { getSession, type Session } from '@/lib/session';
import { SavePlan } from './save-plan';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await getSharedPlan((await params).token);
  if (!plan) return { title: 'Plan not found' };
  const description = `${describeWhen(plan)}. ${plan.summary}`;
  return {
    title: plan.title,
    description,
    // Shared links are private to whoever got them: keep them out of search engines.
    robots: { index: false, follow: false },
    openGraph: { title: plan.title, description, type: 'website', siteName: 'LinkUp' },
  };
}

export default async function SharedPlanPage({ params }: Props) {
  const { token } = await params;
  const plan = await getSharedPlan(token);
  if (!plan) notFound();
  const session = await getSession();
  const alreadySaved = session ? await isSaved(session, plan.id) : false;

  return (
    <>
      <SiteHeader account={<AccountMenu session={session} here={`/plan/${token}`} />} />
      <main className="mx-auto max-w-5xl px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <p className="text-haze">{describeWhen(plan)}</p>
          <h1 className="mt-2 font-display text-4xl leading-none font-bold tracking-tight text-balance sm:text-6xl">
            {plan.title}
          </h1>
          {plan.summary && (
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-haze">{plan.summary}</p>
          )}

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-sm text-haze">Per person</dt>
              <dd className="font-display text-2xl font-semibold">
                {plan.estimatedCostPerPerson === null
                  ? 'Not known'
                  : `About ${formatEuros(plan.estimatedCostPerPerson)}`}
              </dd>
            </div>
            {plan.estimatedTotalCost !== null && (
              <div>
                <dt className="text-sm text-haze">For the group</dt>
                <dd className="font-display text-2xl font-semibold">
                  About {formatEuros(plan.estimatedTotalCost)}
                </dd>
              </div>
            )}
            {plan.totalDistanceKm > 0 && (
              <div>
                <dt className="text-sm text-haze">Distance</dt>
                <dd className="font-display text-2xl font-semibold">
                  {formatKm(plan.totalDistanceKm)}
                </dd>
              </div>
            )}
          </dl>

          <SavePlan shareToken={token} loggedIn={!!session} alreadySaved={alreadySaved} />

          <section aria-label="Stops" className="mt-12 rounded-3xl bg-dusk p-5 sm:p-8">
            <Route stops={toRouteStops(plan)} />
          </section>

          <p className="mt-8 max-w-prose text-sm text-haze">
            Someone shared this plan with you from the LinkUp app. You can see it here, but only
            they can change it. Prices are estimates.
          </p>
          <p className="mt-3 max-w-prose text-sm text-haze">
            Have the LinkUp app? Copy this page’s link, then in the app go to Saved and choose “Open
            a shared link” to keep your own copy.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

// Only to show "already saved"; if the account can't be checked, offering to save again is harmless.
async function isSaved(session: Session, planId: string) {
  try {
    return await hasSavedPlan(session.accessToken, planId);
  } catch (error) {
    if (!(error instanceof SessionExpiredError)) console.warn('Could not check saved plans', error);
    return false;
  }
}
