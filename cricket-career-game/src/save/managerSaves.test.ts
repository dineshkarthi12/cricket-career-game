import { beforeEach, describe, expect, it } from 'vitest';
import { createManagerCareer } from '@/engine/manager/create';
import { createNewCareer } from '@/engine/newCareer';
import { produce } from '@/engine/manager/util';
import { exportSave, importSave, listSlots, loadSlot, saveToSlot } from './saveSystem';
import {
  deleteManager,
  exportManager,
  importManager,
  listManagerSlots,
  loadManager,
  migrateManager,
  saveManager,
  validateManagerState,
} from './managerSaves';

const manager = () => createManagerCareer({ name: 'Asha Rao', franchiseId: 'team-gateway-giants', difficulty: 'NORMAL', pathway: 'SCOUTING', seed: 3 });
const career = () => createNewCareer({ firstName: 'Dinesh', lastName: 'K', dateOfBirth: '2016-04-12', creationRole: 'BATTER', bowlingStyle: 'NONE', seed: 9 });

describe('manager saves', () => {
  beforeEach(() => localStorage.clear());

  it('save and load round-trip, with a slot header', async () => {
    const s = manager();
    const saved = await saveManager(2, s);
    expect(saved.ok).toBe(true);
    expect(listManagerSlots()[1]?.managerName).toBe('Asha Rao');
    const loaded = await loadManager(2);
    expect(loaded.ok && loaded.value).toEqual(s);
    expect(await deleteManager(2)).toMatchObject({ ok: true });
    expect((await loadManager(2)).ok).toBe(false);
  });

  it('a manager save and a player career never share or overwrite each other', async () => {
    const c = career();
    const m = manager();
    expect(saveToSlot(1, c).ok).toBe(true);
    expect((await saveManager(1, m)).ok).toBe(true);
    // Same slot number, different worlds.
    const loadedCareer = loadSlot(1);
    expect(loadedCareer.ok && loadedCareer.value.state.player.firstName).toBe('Dinesh');
    expect(listSlots()[0]?.playerName).toContain('Dinesh');
    const loadedManager = await loadManager(1);
    expect(loadedManager.ok && loadedManager.value.profile.name).toBe('Asha Rao');
    // Deleting one leaves the other alone.
    await deleteManager(1);
    expect(loadSlot(1).ok).toBe(true);
  });

  it('refuses a career file in the manager import and the other way round', () => {
    const careerFile = exportSave(career(), 1);
    expect(careerFile.ok).toBe(true);
    const asManager = importManager(careerFile.ok ? careerFile.value : '');
    expect(asManager.ok).toBe(false);
    const managerFile = exportManager(manager());
    expect(managerFile.ok).toBe(true);
    const asCareer = importSave(managerFile.ok ? managerFile.value : '');
    expect(asCareer.ok).toBe(false);
    const back = importManager(managerFile.ok ? managerFile.value : '');
    expect(back.ok).toBe(true);
  });

  it('refuses damaged, inconsistent and newer saves rather than guessing', () => {
    expect(importManager('{not json').ok).toBe(false);
    const m = manager();
    expect(migrateManager({ ...m, version: 99 })).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_VERSION' } });
    // A player in two squads.
    const twice = produce(m, (d) => {
      const [a, b] = Object.values(d.franchises);
      b.squadIds.push(a.squadIds[0]);
    });
    expect(validateManagerState(twice)).not.toBeNull();
    // A transaction recorded twice.
    const doubled = produce(m, (d) => {
      d.finances.ledger.push({ id: 'x', season: 2027, week: 0, kind: 'OTHER', amount: 1, note: '' });
      d.finances.ledger.push({ id: 'x', season: 2027, week: 0, kind: 'OTHER', amount: 1, note: '' });
    });
    expect(validateManagerState(doubled)).toMatch(/twice/);
  });

  it('will not write an invalid state over a good save', async () => {
    const m = manager();
    await saveManager(3, m);
    const broken = produce(m, (d) => void (d.franchiseId = 'nope'));
    expect((await saveManager(3, broken)).ok).toBe(false);
    const still = await loadManager(3);
    expect(still.ok && still.value.franchiseId).toBe(m.franchiseId);
  });
});
