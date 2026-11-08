// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStreamingClient,
  inspectStreamingFile,
} from '../create-client';

class MockWorker {
  static instance: MockWorker;

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    MockWorker.instance = this;
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe('Streaming Client', () => {
  it('inspects a file and returns bounded schema information', async () => {
    const file = new File(
      ['[{"name":"Alpha","score":10}]'],
      'input.json',
    );

    const promise = inspectStreamingFile(file, 'json', {
      maxRows: 100,
      maxPreviewRows: 20,
      maxPreviewBytes: 1024,
    });

    const worker = MockWorker.instance;
    const message = worker.postMessage.mock.calls[0][0];

    expect(message.type).toBe('INSPECT_FILE');
    expect(message.payload.file).toBe(file);
    expect(message.payload.inputFormat).toBe('json');
    expect(message.payload.options).toEqual({
      maxRows: 100,
      maxPreviewRows: 20,
      maxPreviewBytes: 1024,
    });

    worker.emit({
      status: 'inspected',
      fields: ['name', 'score'],
      previewRows: [{ name: 'Alpha', score: 10 }],
      rowsInspected: 1,
      previewTruncated: false,
    });

    await expect(promise).resolves.toEqual({
      fields: ['name', 'score'],
      previewRows: [{ name: 'Alpha', score: 10 }],
      rowsInspected: 1,
      previewTruncated: false,
    });

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('rejects when file inspection fails', async () => {
    const promise = inspectStreamingFile(
      new File(['invalid'], 'input.json'),
      'json',
    );

    const worker = MockWorker.instance;
    worker.emit({
      status: 'error',
      message: 'Invalid input data.',
    });

    await expect(promise).rejects.toThrow('Invalid input data.');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  let outputFile: File;
  let removeEntry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);

    outputFile = new File(['{"id":1}'], 'output.json', {
      type: 'application/json',
    });

    removeEntry = vi.fn().mockResolvedValue(undefined);

    const root = {
      getFileHandle: vi.fn().mockResolvedValue({
        getFile: vi.fn().mockResolvedValue(outputFile),
      }),
      removeEntry,
    };

    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        getDirectory: vi.fn().mockResolvedValue(root),
      },
    });
  });

  it('starts a conversion and resolves its result', async () => {
    const file = new File(['[]'], 'input.json');
    const onProgress = vi.fn();

    const client = createStreamingClient({
      file,
      inputFormat: 'json',
      outputFormat: 'csv',
      selectedFields: ['score', 'name'],
      fieldRenames: { score: 'points', name: 'label' },
      onProgress,
    });

    const worker = MockWorker.instance;
    const startMessage = worker.postMessage.mock.calls[0][0];

    expect(startMessage.type).toBe('START_CONVERT');
    expect(startMessage.payload.file).toBe(file);
    expect(startMessage.payload.inputFormat).toBe('json');
    expect(startMessage.payload.outputFormat).toBe('csv');
    expect(startMessage.payload.selectedFields).toEqual(['score', 'name']);
    expect(startMessage.payload.fieldRenames).toEqual({
      score: 'points',
      name: 'label',
    });
    expect(startMessage.payload.fileName).toMatch(/\.csv$/);

    worker.emit({ status: 'started' });
    worker.emit({
      status: 'chunk',
      chunkIndex: 2,
      totalRows: 20,
      parseErrors: 1,
    });
    worker.emit({
      status: 'completed',
      fileName: startMessage.payload.fileName,
      chunkIndex: 2,
      totalRows: 20,
      parseErrors: 1,
    });

    await expect(client.promise).resolves.toMatchObject({
      outputFormat: 'csv',
      chunks: 2,
      rows: 20,
      parseErrors: 1,
    });

    expect(onProgress).toHaveBeenCalledWith({
      chunks: 2,
      rows: 20,
      parseErrors: 1,
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('waits for worker startup before sending cancellation', async () => {
    const client = createStreamingClient({
      file: new File(['[]'], 'input.json'),
      inputFormat: 'json',
      outputFormat: 'json',
    });

    const worker = MockWorker.instance;

    client.cancel();

    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    worker.emit({ status: 'started' });

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1][0]).toEqual({
      type: 'CANCEL',
    });

    worker.emit({ status: 'cancelled' });

    await expect(client.promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reads a bounded text preview and removes the output file', async () => {
    const client = createStreamingClient({
      file: new File(['[]'], 'input.json'),
      inputFormat: 'json',
      outputFormat: 'json',
    });

    const worker = MockWorker.instance;
    const startMessage = worker.postMessage.mock.calls[0][0];

    worker.emit({ status: 'started' });
    worker.emit({
      status: 'completed',
      fileName: startMessage.payload.fileName,
      chunkIndex: 1,
      totalRows: 1,
      parseErrors: 0,
    });

    await client.promise;

    const preview = await client.readPreview(5);

    expect(preview).toEqual({
      text: '{"id"',
      truncated: true,
      size: 8,
    });

    await expect(client.getOutputFile()).resolves.toBe(outputFile);

    await client.removeOutput();

    expect(removeEntry).toHaveBeenCalledWith(
      startMessage.payload.fileName,
    );
  });

  it('rejects when the worker reports an error', async () => {
    const client = createStreamingClient({
      file: new File(['[]'], 'input.json'),
      inputFormat: 'json',
      outputFormat: 'json',
    });

    const worker = MockWorker.instance;

    worker.emit({
      status: 'error',
      message: 'Invalid input data.',
    });

    await expect(client.promise).rejects.toThrow('Invalid input data.');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('rejects text preview requests for XLSX output', async () => {
    const client = createStreamingClient({
      file: new File(['[]'], 'input.json'),
      inputFormat: 'json',
      outputFormat: 'excel',
    });

    await expect(client.readPreview()).rejects.toThrow(
      'Binary XLSX output cannot be displayed as text.',
    );

    client.cancel();
    MockWorker.instance.emit({ status: 'started' });
    MockWorker.instance.emit({ status: 'cancelled' });

    await expect(client.promise).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
