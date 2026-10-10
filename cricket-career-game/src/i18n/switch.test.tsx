import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import { useAppSettings } from '@/store/appSettings';
import { useGameStore } from '@/store/gameStore';
import { formatLongDate } from '@/lib/format';
import { setCurrentLang } from './core';

afterEach(() => {
  useAppSettings.getState().set({ language: 'en' });
  setCurrentLang('en');
});

describe('switching language', () => {
  it('Settings > Language switches the whole frame at once, and is remembered', () => {
    localStorage.clear();
    useGameStore.getState().loadDemoCareer(1);
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppShell>
          <SettingsScreen />
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    const picker = screen.getByRole('radiogroup', { name: 'Language' });
    fireEvent.click(within(picker).getByRole('radio', { name: 'தமிழ்' }));
    // The screen, the navigation and the top bar, straight away.
    expect(screen.getByRole('heading', { level: 1, name: 'அமைப்புகள்' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /முகப்பு/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('கேரியர்').length).toBeGreaterThan(0);
    expect(useAppSettings.getState().language).toBe('ta');
    expect(JSON.parse(localStorage.getItem('cc.appSettings')!).language).toBe('ta');
    // And back.
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'மொழி' })).getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('dates use Tamil month names, with Western digits', () => {
    setCurrentLang('ta');
    expect(formatLongDate('2026-10-15')).toBe('வியாழன், 15 அக்டோபர் 2026');
    setCurrentLang('en');
    expect(formatLongDate('2026-10-15')).toBe('Thu, 15 Oct 2026');
  });
});
