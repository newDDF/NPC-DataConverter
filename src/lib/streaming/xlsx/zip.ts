const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const MAX_ZIP_COMMENT_SIZE = 0xffff;
const MAX_CENTRAL_DIRECTORY_SIZE = 16 * 1024 * 1024;
const ZIP32_MAX = 0xffffffff;

export type ZipEntry = {
  name: string;
  flags: number;
  method: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0
        ? (value >>> 1) ^ 0xedb88320
        : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function updateCrc32(state: number, data: Uint8Array): number {
  let value = state;

  for (let index = 0; index < data.length; index += 1) {
    value = CRC_TABLE[(value ^ data[index]) & 0xff] ^ (value >>> 8);
  }

  return value >>> 0;
}

export function calculateCrc32(data: Uint8Array): number {
  return (updateCrc32(0xffffffff, data) ^ 0xffffffff) >>> 0;
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

export async function readZipDirectory(file: File): Promise<ZipEntry[]> {
  if (file.size < 22) {
    throw new Error('Invalid ZIP file: end of central directory not found.');
  }

  const tailSize = Math.min(file.size, 22 + MAX_ZIP_COMMENT_SIZE);
  const tailStart = file.size - tailSize;
  const tail = await file.slice(tailStart).arrayBuffer();
  const tailView = new DataView(tail);

  let endOffset = -1;

  for (let offset = tail.byteLength - 22; offset >= 0; offset -= 1) {
    if (
      readUint32(tailView, offset) ===
      END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      const commentLength = readUint16(tailView, offset + 20);

      if (offset + 22 + commentLength === tail.byteLength) {
        endOffset = offset;
        break;
      }
    }
  }

  if (endOffset < 0) {
    throw new Error('Invalid ZIP file: end of central directory not found.');
  }

  const diskNumber = readUint16(tailView, endOffset + 4);
  const centralDirectoryDisk = readUint16(tailView, endOffset + 6);
  const entriesOnDisk = readUint16(tailView, endOffset + 8);
  const entryCount = readUint16(tailView, endOffset + 10);
  const centralDirectorySize = readUint32(tailView, endOffset + 12);
  const centralDirectoryOffset = readUint32(tailView, endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount
  ) {
    throw new Error('Multi-disk ZIP files are not supported.');
  }

  if (
    entryCount === 0xffff ||
    centralDirectorySize === ZIP32_MAX ||
    centralDirectoryOffset === ZIP32_MAX
  ) {
    throw new Error('ZIP64 files are not supported.');
  }

  if (centralDirectorySize > MAX_CENTRAL_DIRECTORY_SIZE) {
    throw new Error('ZIP central directory exceeds the supported size.');
  }

  if (
    centralDirectoryOffset + centralDirectorySize >
    tailStart + endOffset
  ) {
    throw new Error('Invalid ZIP file: central directory is out of bounds.');
  }

  const directoryBuffer = await file
    .slice(
      centralDirectoryOffset,
      centralDirectoryOffset + centralDirectorySize,
    )
    .arrayBuffer();

  const directoryView = new DataView(directoryBuffer);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: ZipEntry[] = [];

  let offset = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > directoryBuffer.byteLength ||
      readUint32(directoryView, offset) !== CENTRAL_FILE_SIGNATURE
    ) {
      throw new Error('Invalid ZIP file: malformed central directory.');
    }

    const flags = readUint16(directoryView, offset + 8);
    const method = readUint16(directoryView, offset + 10);
    const crc32 = readUint32(directoryView, offset + 16);
    const compressedSize = readUint32(directoryView, offset + 20);
    const uncompressedSize = readUint32(directoryView, offset + 24);
    const nameLength = readUint16(directoryView, offset + 28);
    const extraLength = readUint16(directoryView, offset + 30);
    const commentLength = readUint16(directoryView, offset + 32);
    const diskStart = readUint16(directoryView, offset + 34);
    const localHeaderOffset = readUint32(directoryView, offset + 42);

    const recordEnd =
      offset + 46 + nameLength + extraLength + commentLength;

    if (recordEnd > directoryBuffer.byteLength) {
      throw new Error('Invalid ZIP file: truncated central directory entry.');
    }

    if ((flags & 0x0001) !== 0) {
      throw new Error('Encrypted ZIP entries are not supported.');
    }

    if (diskStart !== 0) {
      throw new Error('Multi-disk ZIP entries are not supported.');
    }

    if (method !== 0 && method !== 8) {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }

    if (
      compressedSize === ZIP32_MAX ||
      uncompressedSize === ZIP32_MAX ||
      localHeaderOffset === ZIP32_MAX
    ) {
      throw new Error('ZIP64 entries are not supported.');
    }

    const nameBytes = new Uint8Array(
      directoryBuffer,
      offset + 46,
      nameLength,
    );

    let name: string;

    try {
      name = decoder.decode(nameBytes);
    } catch {
      throw new Error('ZIP entry name is not valid UTF-8.');
    }

    entries.push({
      name,
      flags,
      method,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset = recordEnd;
  }

  if (offset !== directoryBuffer.byteLength) {
    throw new Error('Invalid ZIP file: unexpected central directory data.');
  }

  return entries;
}

export async function* readZipEntry(
  file: File,
  entry: ZipEntry,
  signal?: AbortSignal,
  maxUncompressedBytes = 256 * 1024 * 1024,
): AsyncGenerator<Uint8Array> {
  throwIfAborted(signal);

  if (!Number.isSafeInteger(maxUncompressedBytes) || maxUncompressedBytes <= 0) {
    throw new RangeError('ZIP entry size limit must be a positive safe integer.');
  }

  if (entry.uncompressedSize > maxUncompressedBytes) {
    throw new Error(`ZIP entry exceeds the configured uncompressed size limit: ${entry.name}`);
  }

  if (entry.localHeaderOffset + 30 > file.size) {
    throw new Error(`Invalid ZIP entry header: ${entry.name}`);
  }

  const headerBuffer = await file
    .slice(entry.localHeaderOffset, entry.localHeaderOffset + 30)
    .arrayBuffer();

  const headerView = new DataView(headerBuffer);

  if (readUint32(headerView, 0) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid ZIP local header: ${entry.name}`);
  }

  const localFlags = readUint16(headerView, 6);
  const localMethod = readUint16(headerView, 8);
  const nameLength = readUint16(headerView, 26);
  const extraLength = readUint16(headerView, 28);

  if (
    localFlags !== entry.flags ||
    localMethod !== entry.method
  ) {
    throw new Error(`ZIP entry header mismatch: ${entry.name}`);
  }

  const dataStart =
    entry.localHeaderOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > file.size || dataEnd < dataStart) {
    throw new Error(`ZIP entry data is out of bounds: ${entry.name}`);
  }

  const blob = file.slice(dataStart, dataEnd);
  let stream: ReadableStream<Uint8Array>;

  if (typeof blob.stream === 'function') {
    stream = blob.stream() as ReadableStream<Uint8Array>;
  } else {
    stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DEFLATE decompression is not supported.');
    }

    try {
      const decompressor = new DecompressionStream('deflate-raw');
      stream = stream.pipeThrough(
        decompressor as unknown as ReadableWritablePair<Uint8Array, Uint8Array>,
      ) as ReadableStream<Uint8Array>;
    } catch {
      throw new Error('Raw DEFLATE decompression is not supported.');
    }
  }

  const reader = stream.getReader();
  let crcState = 0xffffffff;
  let totalBytes = 0;
  let finished = false;

  try {
    while (true) {
      throwIfAborted(signal);

      const result = await reader.read();

      if (result.done) {
        finished = true;
        break;
      }

      const chunk = result.value;

      totalBytes += chunk.byteLength;

      if (totalBytes > entry.uncompressedSize) {
        throw new Error(`ZIP entry exceeds its declared size: ${entry.name}`);
      }

      if (totalBytes > maxUncompressedBytes) {
        throw new Error(`ZIP entry exceeds the configured uncompressed size limit: ${entry.name}`);
      }

      crcState = updateCrc32(crcState, chunk);

      if (chunk.byteLength > 0) {
        yield chunk;
      }
    }

    const actualCrc = (crcState ^ 0xffffffff) >>> 0;

    if (totalBytes !== entry.uncompressedSize) {
      throw new Error(`ZIP entry size mismatch: ${entry.name}`);
    }

    if (actualCrc !== entry.crc32) {
      throw new Error(`ZIP entry CRC32 mismatch: ${entry.name}`);
    }
  } finally {
    if (!finished) {
      try {
        await reader.cancel();
      } catch {
        // Preserve the original error.
      }
    }

    reader.releaseLock();
  }
}

type ZipSource =
  | Uint8Array
  | string
  | AsyncIterable<Uint8Array>;

type ZipCentralEntry = {
  name: Uint8Array;
  crc32: number;
  size: number;
  offset: number;
};

async function* toByteChunks(
  source: ZipSource,
): AsyncGenerator<Uint8Array> {
  if (typeof source === 'string') {
    yield new TextEncoder().encode(source);
    return;
  }

  if (
    ArrayBuffer.isView(source) &&
    source.BYTES_PER_ELEMENT === 1
  ) {
    const bytes = new Uint8Array(
      source.buffer,
      source.byteOffset,
      source.byteLength,
    );

    if (bytes.byteLength > 0) {
      yield bytes;
    }
    return;
  }

  for await (const chunk of source as AsyncIterable<Uint8Array>) {
    yield chunk;
  }
}

export class ZipStoreWriter {
  private offset = 0;
  private readonly entries: ZipCentralEntry[] = [];
  private closed = false;

  constructor(
    private readonly writeChunk: (chunk: Uint8Array) => Promise<void>,
  ) {}

  private async write(data: Uint8Array): Promise<void> {
    if (data.byteLength === 0) {
      return;
    }

    if (this.offset + data.byteLength > ZIP32_MAX) {
      throw new Error('ZIP32 output size limit exceeded.');
    }

    await this.writeChunk(data);
    this.offset += data.byteLength;
  }

  async addEntry(name: string, source: ZipSource): Promise<void> {
    if (this.closed) {
      throw new Error('ZIP writer is already closed.');
    }

    if (!name || name.startsWith('/') || name.includes('\\')) {
      throw new TypeError('Invalid ZIP entry name.');
    }

    const nameBytes = new TextEncoder().encode(name);

    if (nameBytes.byteLength > 0xffff) {
      throw new RangeError('ZIP entry name is too long.');
    }

    const localOffset = this.offset;
    const flags = 0x0808;
    const header = new Uint8Array(30 + nameBytes.byteLength);
    const view = new DataView(header.buffer);

    writeUint32(view, 0, LOCAL_FILE_SIGNATURE);
    writeUint16(view, 4, 20);
    writeUint16(view, 6, flags);
    writeUint16(view, 8, 0);
    writeUint16(view, 10, 0);
    writeUint16(view, 12, 0x0021);
    writeUint32(view, 14, 0);
    writeUint32(view, 18, 0);
    writeUint32(view, 22, 0);
    writeUint16(view, 26, nameBytes.byteLength);
    writeUint16(view, 28, 0);
    header.set(nameBytes, 30);

    await this.write(header);

    let crcState = 0xffffffff;
    let size = 0;

    for await (const chunk of toByteChunks(source)) {
      const bytes = new Uint8Array(chunk);

      if (size + bytes.byteLength > ZIP32_MAX) {
        throw new Error(`ZIP32 entry size limit exceeded: ${name}`);
      }

      crcState = updateCrc32(crcState, bytes);
      size += bytes.byteLength;

      await this.write(bytes);
    }

    const crc32 = (crcState ^ 0xffffffff) >>> 0;
    const descriptor = new Uint8Array(16);
    const descriptorView = new DataView(descriptor.buffer);

    writeUint32(descriptorView, 0, DATA_DESCRIPTOR_SIGNATURE);
    writeUint32(descriptorView, 4, crc32);
    writeUint32(descriptorView, 8, size);
    writeUint32(descriptorView, 12, size);

    await this.write(descriptor);

    this.entries.push({
      name: nameBytes,
      crc32,
      size,
      offset: localOffset,
    });
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    const centralOffset = this.offset;

    for (const entry of this.entries) {
      const header = new Uint8Array(46 + entry.name.byteLength);
      const view = new DataView(header.buffer);

      writeUint32(view, 0, CENTRAL_FILE_SIGNATURE);
      writeUint16(view, 4, 20);
      writeUint16(view, 6, 20);
      writeUint16(view, 8, 0x0808);
      writeUint16(view, 10, 0);
      writeUint16(view, 12, 0);
      writeUint16(view, 14, 0x0021);
      writeUint32(view, 16, entry.crc32);
      writeUint32(view, 20, entry.size);
      writeUint32(view, 24, entry.size);
      writeUint16(view, 28, entry.name.byteLength);
      writeUint16(view, 30, 0);
      writeUint16(view, 32, 0);
      writeUint16(view, 34, 0);
      writeUint16(view, 36, 0);
      writeUint32(view, 38, 0);
      writeUint32(view, 42, entry.offset);
      header.set(entry.name, 46);

      await this.write(header);
    }

    const centralSize = this.offset - centralOffset;

    if (
      this.entries.length > 0xffff ||
      centralOffset > ZIP32_MAX ||
      centralSize > ZIP32_MAX
    ) {
      throw new Error('ZIP32 central directory limit exceeded.');
    }

    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);

    writeUint32(view, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
    writeUint16(view, 4, 0);
    writeUint16(view, 6, 0);
    writeUint16(view, 8, this.entries.length);
    writeUint16(view, 10, this.entries.length);
    writeUint32(view, 12, centralSize);
    writeUint32(view, 16, centralOffset);
    writeUint16(view, 20, 0);

    await this.write(end);
  }
}
