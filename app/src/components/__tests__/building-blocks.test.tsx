import { render, screen, userEvent } from '@testing-library/react-native';

import { Avatar } from '@/components/avatar';
import { ErrorNote } from '@/components/error-note';
import { Icon } from '@/components/icon';
import { LinkRow } from '@/components/link-row';
import { PageHeader } from '@/components/page-header';

describe('Avatar', () => {
  it('shows the first letter of the name in capitals', async () => {
    await render(<Avatar name="  ann" />);

    expect(screen.getByText('A', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('falls back to a question mark when there is no name', async () => {
    await render(<Avatar name="   " />);

    expect(screen.getByText('?', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('is hidden from screen readers, because the name is always written beside it', async () => {
    await render(<Avatar name="Ann" />);

    expect(screen.queryByText('A')).toBeNull();
  });
});

describe('PageHeader', () => {
  it('shows the title as a heading with its description', async () => {
    await render(
      <PageHeader icon="log-in-outline" title="Welcome back" description="Log in to continue." />,
    );

    expect(screen.getByRole('header', { name: 'Welcome back' })).toBeOnTheScreen();
    expect(screen.getByText('Log in to continue.')).toBeOnTheScreen();
  });

  it('leaves the description out when there is none', async () => {
    await render(<PageHeader icon="person-circle-outline" title="Account" />);

    expect(screen.getByRole('header', { name: 'Account' })).toBeOnTheScreen();
    expect(screen.queryByText('Log in to continue.')).toBeNull();
  });
});

describe('ErrorNote', () => {
  it('shows the problem and announces it when it appears', async () => {
    await render(<ErrorNote>Wrong email or password.</ErrorNote>);

    const message = screen.getByText('Wrong email or password.');
    expect(message).toBeOnTheScreen();

    // The live region is on the box around the message, not on the text itself.
    let box = message.parent;
    while (box && box.props.accessibilityLiveRegion === undefined) box = box.parent;
    expect(box?.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('LinkRow', () => {
  it('is a button named by its title that runs its action', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <LinkRow
        title="Friends"
        icon="people-outline"
        description="Requests, and people to plan nights with"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Requests, and people to plan nights with')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Friends' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('works without a description', async () => {
    await render(
      <LinkRow title="Default preferences" icon="options-outline" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Default preferences' })).toBeOnTheScreen();
  });
});

describe('Icon', () => {
  it('draws the named icon and hides it from screen readers', async () => {
    await render(<Icon name="sparkles" />);

    expect(screen.queryByText('[sparkles]')).toBeNull();
    expect(screen.getByText('[sparkles]', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
