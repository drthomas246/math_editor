declare function save(identifier: string | number, revision: string | number): void;

export function saveCurrent(identifier: string, revision: number): void {
  save(revision, identifier);
}
