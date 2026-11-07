import { convertStreamingFile } from '../lib/streaming/core/pipeline';
import type { StreamingOutputSink } from '../lib/streaming/core/contracts';
import type { StreamingFormat } from '../lib/streaming/types';

type TaskState =
  | 'active'
  | 'cancelling'
  | 'completing'
  | 'failing'
  | 'completed'
  | 'cancelled'
  | 'error';

type ConversionTask = {
  file: File;
  fileName: string;
  inputFormat: StreamingFormat;
  outputFormat: StreamingFormat;
  state: TaskState;
  controller: AbortController;
  writable: FileSystemWritableFileStream | null;
  rootDir: FileSystemDirectoryHandle | null;
  setupPromise: Promise<void>;
  conversionPromise: Promise<unknown> | null;
  cleanupPromise: Promise<void> | null;
  donePromise: Promise<void>;
  resolveDone: () => void;
};

let currentTask: ConversionTask | null = null;
let startQueue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'CANCEL') {
    const task = currentTask;

    if (task) {
      void cancelTask(task);
    }

    return;
  }

  if (type === 'START_CONVERT') {
    startQueue = startQueue
      .then(() => startConversion(
        payload.file,
        payload.fileName,
        payload.inputFormat,
        payload.outputFormat,
      ))
      .catch((error) => {
        self.postMessage({
          status: 'error',
          message: getErrorMessage(error),
        });
      });
  }
};

function createTask(
  file: File,
  fileName: string,
  inputFormat: StreamingFormat,
  outputFormat: StreamingFormat,
): ConversionTask {
  let resolveDone!: () => void;

  const donePromise = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  return {
    file,
    fileName,
    inputFormat,
    outputFormat,
    state: 'active',
    controller: new AbortController(),
    writable: null,
    rootDir: null,
    setupPromise: Promise.resolve(),
    conversionPromise: null,
    cleanupPromise: null,
    donePromise,
    resolveDone,
  };
}

function settleTask(task: ConversionTask) {
  if (currentTask === task) {
    currentTask = null;
  }

  task.resolveDone();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createOutputSink(task: ConversionTask): StreamingOutputSink {
  return {
    async write(data) {
      if (!task.writable) {
        throw new Error('Output stream is unavailable.');
      }

      const chunk = typeof data === 'string'
        ? data
        : data.slice().buffer as ArrayBuffer;

      await task.writable.write(chunk);
    },

    async close() {
      if (!task.writable) {
        throw new Error('Output stream is unavailable.');
      }

      const writable = task.writable;
      await writable.close();
      task.writable = null;
    },

    async abort(reason) {
      const writable = task.writable;
      task.writable = null;

      if (writable) {
        await writable.abort(reason);
      }
    },
  };
}

async function startConversion(
  file: File,
  fileName: string,
  inputFormat: StreamingFormat,
  outputFormat: StreamingFormat,
) {
  const previousTask = currentTask;

  if (previousTask) {
    if (previousTask.state === 'active') {
      await cancelTask(previousTask);
    } else {
      await previousTask.donePromise;
    }
  }

  const targetFileName = fileName || `converted_${Date.now()}.${outputFormat}`;

  const task = createTask(file, targetFileName, inputFormat, outputFormat);
  currentTask = task;

  task.setupPromise = (async () => {
    task.rootDir = await navigator.storage.getDirectory();

    const fileHandle = await task.rootDir.getFileHandle(
      task.fileName,
      { create: true },
    );

    task.writable = await fileHandle.createWritable();
  })();

  try {
    await task.setupPromise;
  } catch (error) {
    await failTask(task, error);
    return;
  }

  if (task.state !== 'active') {
    return;
  }

  self.postMessage({ status: 'started' });

  const conversionPromise = convertStreamingFile({
    file: task.file,
    inputFormat: task.inputFormat,
    outputFormat: task.outputFormat,
    sink: createOutputSink(task),
    signal: task.controller.signal,
    onProgress(progress) {
      if (task.state !== 'active') {
        return;
      }

      self.postMessage({
        status: 'chunk',
        chunkIndex: progress.chunks,
        totalRows: progress.rows,
        parseErrors: progress.parseErrors,
      });
    },
  });

  task.conversionPromise = conversionPromise;

  try {
    const result = await conversionPromise;

    if (task.state !== 'active') {
      return;
    }

    task.state = 'completing';

    self.postMessage({
      status: 'completed',
      fileName: task.fileName,
      chunkIndex: result.chunks,
      totalRows: result.rows,
      parseErrors: result.parseErrors,
    });

    task.state = 'completed';
    settleTask(task);
  } catch (error) {
    if (task.controller.signal.aborted) {
      return;
    }

    await failTask(task, error);
  }
}

async function cancelTask(task: ConversionTask) {
  if (
    task.state === 'cancelled' ||
    task.state === 'completed' ||
    task.state === 'error'
  ) {
    return;
  }

  if (task.state === 'completing' || task.state === 'failing') {
    await task.donePromise;
    return;
  }

  if (task.state === 'cancelling') {
    await task.donePromise;
    return;
  }

  task.state = 'cancelling';
  task.controller.abort();

  await task.setupPromise.catch(() => undefined);
  await task.conversionPromise?.catch(() => undefined);

  await cleanupTask(task);

  task.state = 'cancelled';

  self.postMessage({ status: 'cancelled' });

  settleTask(task);
}

async function failTask(task: ConversionTask, error: unknown) {
  if (
    task.state === 'cancelled' ||
    task.state === 'completed' ||
    task.state === 'error'
  ) {
    return;
  }

  if (task.state === 'cancelling' || task.state === 'failing') {
    await task.donePromise;
    return;
  }

  task.state = 'failing';
  task.controller.abort();

  await task.setupPromise.catch(() => undefined);

  await cleanupTask(task);

  task.state = 'error';

  self.postMessage({
    status: 'error',
    message: getErrorMessage(error),
  });

  settleTask(task);
}

function cleanupTask(task: ConversionTask): Promise<void> {
  if (task.cleanupPromise) {
    return task.cleanupPromise;
  }

  task.cleanupPromise = (async () => {
    if (task.writable) {
      const writable = task.writable;
      task.writable = null;

      try {
        await writable.abort();
      } catch {
        // The writable may already be closed or aborted.
      }
    }

    try {
      const rootDir =
        task.rootDir || await navigator.storage.getDirectory();

      await rootDir.removeEntry(task.fileName);
    } catch {
      // The temporary file may already have been removed.
    }
  })();

  return task.cleanupPromise;
}
