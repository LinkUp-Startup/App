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
      <main className="mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_34rem] lg:gap-16">
          <div>
            <p className="text-mauve">{describeWhen(plan)}</p>
            <h1 className="mt-3 font-display text-6xl leading-none font-black text-balance text-butter uppercase sm:text-8xl">
              {plan.title}
            </h1>
            {plan.summary && (
              <p className="mt-6 max-w-prose text-lg leading-relaxed text-mauve">{plan.summary}</p>
            )}

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="text-sm text-mauve">Per person</dt>
                <dd className="font-display text-3xl font-black">
                  {plan.estimatedCostPerPerson === null
                    ? 'Not known'
                    : `About ${formatEuros(plan.estimatedCostPerPerson)}`}
                </dd>
              </div>
              {plan.estimatedTotalCost !== null && (
                <div>
                  <dt className="text-sm text-mauve">For the group</dt>
                  <dd className="font-display text-3xl font-black">
                    About {formatEuros(plan.estimatedTotalCost)}
                  </dd>
                </div>
              )}
              {plan.totalDistanceKm > 0 && (
                <div>
                  <dt className="text-sm text-mauve">Distance</dt>
                  <dd className="font-display text-3xl font-black">
                    {formatKm(plan.totalDistanceKm)}
                  </dd>
                </div>
              )}
            </dl>

            <SavePlan shareToken={token} loggedIn={!!session} alreadySaved={alreadySaved} />

            <div className="mt-10 max-w-prose space-y-3 border-t-[3px] border-dashed border-plum pt-6 text-sm leading-relaxed text-mauve">
              <p>
                Someone shared this plan with you from the LinkUp app. You can see it here, but only
                they can change it. Prices are estimates.
              </p>
              <p>
                Have the LinkUp app? Copy this page’s link, then in the app go to Saved and choose
                “Open a shared link” to keep your own copy.
              </p>
            </div>
          </div>

          <section aria-label="Stops" className="lg:pt-4">
            <Route stops={toRouteStops(plan)} />
          </section>
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
