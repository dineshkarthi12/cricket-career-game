import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import Home from '@/screens/Home';
import { act } from '@testing-library/react';
import { useAppSettings } from '@/store/appSettings';
import { useGameStore } from '@/store/gameStore';
import { formatLongDate } from '@/lib/format';
import { setCurrentLang } from './core';
import { Route, Routes } from 'react-router-dom';
import MatchesScreen from '@/screens/Matches';
import { exportSave, importSave } from '@/save/saveSystem';
import { useMatchStore } from '@/store/matchStore';
import type { GameState } from '@/types';

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

  it('Home re-renders in Tamil when the language changes', () => {
    localStorage.clear();
    useGameStore.getState().loadDemoCareer(1);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Next Match' })).toBeInTheDocument();
    act(() => useAppSettings.getState().set({ language: 'ta' }));
    expect(screen.getByRole('heading', { name: 'அடுத்த மேட்ச்' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'அடுத்து' })).toBeInTheDocument();
    expect(screen.getByText('உங்கள் கேரியர் பயணம்')).toBeInTheDocument();
    // The player's name and the teams stay as they are.
    expect(screen.getByRole('heading', { level: 1, name: 'Dinesh' })).toBeInTheDocument();
  });

  it('dates use Tamil month names, with Western digits', () => {
    setCurrentLang('ta');
    expect(formatLongDate('2026-10-15')).toBe('வியாழன், 15 அக்டோபர் 2026');
    setCurrentLang('en');
    expect(formatLongDate('2026-10-15')).toBe('Thu, 15 Oct 2026');
  });

  it('an old save, with English-only commentary, still loads and reads in Tamil', () => {
    localStorage.clear();
    useGameStore.getState().loadDemoCareer(1);
    const state = useGameStore.getState().state!;
    const fixture = Object.values(state.fixtures)
      .filter((f) => f.homeTeamId && f.awayTeamId && (state.teams[f.homeTeamId]?.isUserTeam || state.teams[f.awayTeamId]?.isUserTeam))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const match = useMatchStore.getState().quickSim(state, fixture)!;
    expect(match).toBeTruthy();
    // As a save from before the language setting: commentary in English only.
    const old = JSON.parse(JSON.stringify(useGameStore.getState().state)) as GameState;
    for (const m of Object.values(old.matches)) for (const i of m.innings) for (const b of i.deliveries) delete b.commentaryCode;
    const exported = exportSave(old, 1);
    expect(exported.ok).toBe(true);
    const imported = importSave(exported.ok ? exported.value : '');
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    useGameStore.setState({ state: imported.value.state });
    const saved = imported.value.state.matches[match.id];
    const line = saved.innings[0].deliveries.at(-1)?.commentary;
    expect(line).toBeTruthy();

    act(() => useAppSettings.getState().set({ language: 'ta' }));
    render(
      <MemoryRouter initialEntries={[`/matches/${match.id}`]}>
        <Routes>
          <Route path="/matches/:matchId" element={<MatchesScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    // The screen is in Tamil, and the old ball-by-ball shows as it was saved.
    expect(screen.getByText('ஸ்கோர்கார்டு')).toBeInTheDocument();
    expect(screen.getAllByText(line!).length).toBeGreaterThan(0);
  });
});
