import { exampleNight } from '@/lib/example-night';
import { defaultCard, imageSize, shareImage } from '@/lib/share-image';

export const alt = 'LinkUp: your whole night out in Lleida, planned, shown as a few tickets.';
export const size = imageSize;
export const contentType = 'image/png';

export default function Image() {
  return shareImage(defaultCard(exampleNight));
}
