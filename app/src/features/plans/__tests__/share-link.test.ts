import { parseShareToken } from '@/features/plans/share-link';

const token = 'AbC_dEf-0123456789xyzQ';

describe('parseShareToken', () => {
  it.each([
    [`https://linkup.th7bo.dev/plan/${token}`],
    [`https://linkup.th7bo.dev/plan/${token}/`],
    [`linkup.th7bo.dev/plan/${token}?utm=x`],
    [`  Tapas and drinks, Fri 6 Nov\nhttps://linkup.th7bo.dev/plan/${token}  `],
    [token],
  ])('finds the token in %j', (input) => {
    expect(parseShareToken(input)).toBe(token);
  });

  it.each([
    [''],
    ['hello'],
    ['https://linkup.th7bo.dev/'],
    [`https://linkup.th7bo.dev/plan/${token}extra`],
    ['https://linkup.th7bo.dev/plan/short'],
    [`${token}!`],
  ])('rejects %j', (input) => {
    expect(parseShareToken(input)).toBeNull();
  });
});
