declare function save(identifier: string, revision: number): void;

export function saveCurrent(identifier: string, revision: number): void {
  save(identifier, revision);
}
