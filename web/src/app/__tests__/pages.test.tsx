import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';
import NotFound from '../not-found';

describe('home page', () => {
  it('explains LinkUp and shows an example night', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Plan the whole night in one go.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('An example Friday night')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La Casa del Vermut' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Send it to your friends' })).toBeInTheDocument();
  });
});

describe('not found page', () => {
  it('says the page does not exist and links home', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: 'This page doesn’t exist.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });
});
