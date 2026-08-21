import type { AssetRecord, Worksheet } from "../../domain/worksheet/worksheet";

export type WorksheetWithAssets = {
  worksheet: Worksheet;
  assets: AssetRecord[];
};

export type WorksheetListResult = {
  worksheets: Worksheet[];
  invalidCount: number;
};

export type SaveWorksheetOptions = {
  pruneUnreferencedAssets?: boolean;
  retainedAssetIds?: ReadonlySet<string>;
};

export interface WorksheetRepository {
  list(): Promise<WorksheetListResult>;
  get(id: string): Promise<WorksheetWithAssets | null>;
  create(data: WorksheetWithAssets): Promise<void>;
  save(worksheet: Worksheet, options?: SaveWorksheetOptions): Promise<void>;
  trash(id: string): Promise<Worksheet>;
  restore(id: string): Promise<Worksheet>;
  deletePermanently(id: string): Promise<void>;
  emptyTrash(): Promise<number>;
  duplicate(id: string): Promise<Worksheet>;
  putAsset(asset: AssetRecord, worksheet: Worksheet): Promise<void>;
  count(): Promise<number>;
}
