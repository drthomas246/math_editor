export function canSave(ready: boolean, saving: boolean): boolean {
  if (ready && !saving) return true;
  return false;
}
