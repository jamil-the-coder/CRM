export interface StorageProvider {
  readonly name: string;
  /** Persists a file's bytes and returns an opaque key only this provider can read back. */
  save(input: { key: string; data: Buffer }): Promise<void>;
  /** Returns the file's bytes, or null if the key doesn't exist. */
  read(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
