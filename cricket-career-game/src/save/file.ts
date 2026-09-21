import type { GameState, SaveResult, SaveSlotId } from '@/types';
import { exportFileName, exportSave } from './saveSystem';
import { fail, ok } from './storage';

/** Trigger a browser download of the career as a JSON file. */
export function downloadSave(state: GameState, slot: SaveSlotId): SaveResult<string> {
  const exported = exportSave(state, slot);
  if (!exported.ok) return exported;

  const fileName = exportFileName(state);
  try {
    const blob = new Blob([exported.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return ok(fileName);
  } catch (error) {
    return fail('UNKNOWN', `Could not start the download: ${describe(error)}`);
  }
}

/** Read a `File` the player picked, ready to hand to `importSave`. */
export async function readSaveFile(file: File): Promise<SaveResult<string>> {
  try {
    return ok(await file.text());
  } catch (error) {
    return fail('UNKNOWN', `Could not read that file: ${describe(error)}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
