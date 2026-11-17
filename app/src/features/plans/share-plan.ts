import { Platform, Share } from 'react-native';

import { ApiError } from '@/api/client';
import { putSavedPlan, sharePlan, unsharePlan } from '@/api/saved-plans';
import { savePlan, setShareUrl, type SavedPlan } from '@/storage/saved-plans';

import { formatNightDate } from './format';

/**
 * Gets the plan's public link (#154), creating it on the first share. A plan that never reached the account
 * (saved as a guest or offline) is uploaded first, because only plans in the account can be shared.
 */
export async function getShareLink(plan: SavedPlan, accessToken: string): Promise<string> {
  let link;
  try {
    link = await sharePlan(accessToken, plan.id);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
    const saved = await putSavedPlan(accessToken, plan);
    await savePlan(plan, { savedAt: saved.savedAt, synced: true });
    link = await sharePlan(accessToken, plan.id);
  }
  await setShareUrl(plan.id, link.url);
  return link.url;
}

export async function stopSharing(planId: string, accessToken: string): Promise<void> {
  await unsharePlan(accessToken, planId);
  await setShareUrl(planId, null);
}

/** "Tapas and drinks, Fri 6 Nov": what the friend sees above the link. */
export function shareText(plan: SavedPlan) {
  const first = plan.items[0];
  return first ? `${plan.title}, ${formatNightDate(first.startTime)}` : plan.title;
}

/**
 * Opens the phone's share sheet. iOS shows the link as a link preview next to the text; Android only takes
 * text, so the link goes into the message there.
 */
export function openShareSheet(plan: SavedPlan, url: string) {
  const text = shareText(plan);
  return Share.share(
    Platform.OS === 'ios'
      ? { message: text, url }
      : { message: `${text}\n${url}`, title: plan.title },
  );
}
