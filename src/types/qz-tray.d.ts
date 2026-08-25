declare module "qz-tray" {
  const qz: {
    websocket: {
      connect(options?: { retries?: number; delay?: number }): Promise<void>;
      disconnect(): Promise<void>;
      isActive(): boolean;
      setClosedCallbacks(callback: () => void): void;
      setErrorCallbacks(callback: (error: unknown) => void): void;
    };
    printers: {
      find(): Promise<string[]>;
      getDefault(): Promise<string>;
    };
    configs: {
      create(printerName: string, options?: Record<string, unknown>): unknown;
    };
    print(config: unknown, data: Array<Record<string, unknown>>): Promise<void>;
  };
  export = qz;
}
