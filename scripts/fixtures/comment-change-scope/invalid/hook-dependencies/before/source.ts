declare function useEffect(effect: () => void, dependencies: unknown[]): void;
declare function load(value: number): void;

export function useLoader(first: number, second: number): void {
  useEffect(function loadEffect() {
    load(first + second);
  }, [first, second]);
}
