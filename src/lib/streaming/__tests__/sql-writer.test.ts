import { describe, expect, it, vi } from 'vitest';
import { SqlWriter } from '../writers/sql-writer';

describe('SqlWriter', () => {
  it('rejects table names containing empty identifier segments', async () => {
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };

    await expect(
      new SqlWriter().create(sink, { tableName: 'app..users' }),
    ).rejects.toThrow('empty identifier');
  });

  it('rejects empty column names before writing SQL', async () => {
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      abort: vi.fn(async () => {}),
    };

    const session = await new SqlWriter().create(sink);

    await expect(session.write([{ '': 1 }])).rejects.toThrow(
      'column names cannot be empty',
    );
    expect(sink.write).not.toHaveBeenCalled();
  });

  it('aborts the sink when closing fails', async () => {
    const closeError = new Error('Sink close failed');
    const sink = {
      write: vi.fn(async () => {}),
      close: vi.fn(async () => {
        throw closeError;
      }),
      abort: vi.fn(async () => {}),
    };

    const session = await new SqlWriter().create(sink);
    await session.write([{ id: 1 }]);

    await expect(session.close()).rejects.toThrow('Sink close failed');
    expect(sink.abort).toHaveBeenCalledOnce();
    expect(sink.abort).toHaveBeenCalledWith(closeError);
  });
});
