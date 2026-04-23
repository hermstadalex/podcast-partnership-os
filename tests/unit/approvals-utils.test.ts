import {
  deriveApprovalRequestStatus,
  parseManualAssetLines,
} from '@/lib/approvals';

describe('approval helpers', () => {
  it('parses manual asset lines with optional labels and preview urls', () => {
    const parsed = parseManualAssetLines(
      [
        'Clip One | https://example.com/clip-one.mp4 | https://example.com/clip-one.jpg',
        'https://example.com/clip-two.mp4',
      ].join('\n'),
      'short_clip'
    );

    expect(parsed).toEqual([
      {
        title: 'Clip One',
        sourceUrl: 'https://example.com/clip-one.mp4',
        previewUrl: 'https://example.com/clip-one.jpg',
        assetType: 'short_clip',
      },
      {
        title: null,
        sourceUrl: 'https://example.com/clip-two.mp4',
        previewUrl: null,
        assetType: 'short_clip',
      },
    ]);
  });

  it('rejects invalid asset urls', () => {
    expect(() => parseManualAssetLines('not-a-url', 'short_clip')).toThrow(
      'Line 1 must include a valid http(s) asset URL.'
    );
  });

  it('derives aggregate request status from item decisions', () => {
    expect(deriveApprovalRequestStatus(['pending', 'pending'])).toBe('pending');
    expect(deriveApprovalRequestStatus(['approved', 'approved'])).toBe('approved');
    expect(deriveApprovalRequestStatus(['rejected', 'rejected'])).toBe('rejected');
    expect(deriveApprovalRequestStatus(['approved', 'pending'])).toBe('partially_approved');
    expect(deriveApprovalRequestStatus(['approved', 'rejected'])).toBe('partially_approved');
  });
});
