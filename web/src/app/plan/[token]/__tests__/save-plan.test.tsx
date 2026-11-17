import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveSharedPlan } from '@/app/actions/plans';
import { SavePlan } from '../save-plan';

vi.mock('@/app/actions/plans', () => ({ saveSharedPlan: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('SavePlan', () => {
  it('asks a guest to log in and come back', () => {
    render(<SavePlan shareToken="tok" loggedIn={false} alreadySaved={false} />);

    expect(screen.getByRole('link', { name: 'Log in to save this plan' })).toHaveAttribute(
      'href',
      '/login?next=%2Fplan%2Ftok',
    );
  });

  it('says when the plan is already saved', () => {
    render(<SavePlan shareToken="tok" loggedIn alreadySaved />);

    expect(screen.getByRole('status')).toHaveTextContent('This plan is in your saved plans.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('saves the plan and confirms', async () => {
    vi.mocked(saveSharedPlan).mockResolvedValue({ saved: true });
    render(<SavePlan shareToken="tok" loggedIn alreadySaved={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save to my plans' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved to your plans.');
    expect(saveSharedPlan).toHaveBeenCalledWith('tok', expect.anything(), expect.anything());
  });

  it('shows why saving failed and lets you try again', async () => {
    vi.mocked(saveSharedPlan).mockResolvedValue({ error: 'Couldn’t save the plan right now.' });
    render(<SavePlan shareToken="tok" loggedIn alreadySaved={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save to my plans' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save the plan right now.');
    expect(screen.getByRole('button', { name: 'Save to my plans' })).toBeEnabled();
  });
});
