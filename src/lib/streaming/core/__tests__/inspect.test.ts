import { describe, expect, it } from 'vitest';
import { inspectStreamingFile } from '../pipeline';

describe('Streaming file inspection', () => {
  it('returns fields and a bounded preview from the first batch', async () => {
    const file = new File(
      [
        JSON.stringify([
          { name: 'Alpha', score: 10 },
          { name: 'Beta', active: true },
          { name: 'Gamma', score: 30 },
        ]),
      ],
      'input.json',
      { type: 'application/json' },
    );

    const result = await inspectStreamingFile(file, 'json', {
      maxRows: 2,
      maxPreviewRows: 1,
      maxPreviewBytes: 1024,
    });

    expect(result.fields).toEqual(['name', 'score', 'active']);
    expect(result.rowsInspected).toBe(2);
    expect(result.previewRows).toEqual([
      { name: 'Alpha', score: 10 },
    ]);
    expect(result.previewTruncated).toBe(true);
  });

  it('rejects invalid inspection limits', async () => {
    const file = new File(['[]'], 'input.json');

    await expect(
      inspectStreamingFile(file, 'json', { maxRows: 0 }),
    ).rejects.toThrow('maxRows must be a positive integer.');
  });
});
