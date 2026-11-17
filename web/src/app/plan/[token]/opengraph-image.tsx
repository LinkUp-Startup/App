import { getSharedPlan } from '@/lib/api';
import { exampleNight } from '@/lib/example-night';
import { defaultCard, imageSize, planCard, shareImage } from '@/lib/share-image';

export const alt = 'A night out shared from LinkUp, with every stop as a ticket.';
export const size = imageSize;
export const contentType = 'image/png';

type Props = { params: Promise<{ token: string }> };

// A link that isn't shared (anymore), or an API that doesn't answer, still gets the LinkUp preview.
export default async function Image({ params }: Props) {
  const plan = await getSharedPlan((await params).token).catch(() => null);
  return shareImage(plan ? planCard(plan) : defaultCard(exampleNight));
}
