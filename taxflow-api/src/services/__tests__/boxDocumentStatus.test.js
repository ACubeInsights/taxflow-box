import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toApiStatus,
  toBoxStatus,
  API_TO_BOX_STATUS,
  BOX_TO_API_STATUS,
  BoxDocumentStatusService,
} from '../boxDocumentStatusService.js';

const mockGetFileMetadataById = vi.fn();
const mockUpdateFileMetadataById = vi.fn();
const mockCreateFileMetadataById = vi.fn();
const mockExecuteRead = vi.fn();

vi.mock('../boxService.js', () => ({
  default: {
    getTier: vi.fn(() => 'enterprise'),
    getBoxClient: () => ({
      metadataQueries: {
        executeRead: (...args) => mockExecuteRead(...args),
      },
      fileMetadata: {
        getFileMetadataById: (...args) => mockGetFileMetadataById(...args),
        updateFileMetadataById: (...args) => mockUpdateFileMetadataById(...args),
        createFileMetadataById: (...args) => mockCreateFileMetadataById(...args),
      },
    }),
  },
}));

describe('boxDocumentStatusService status mapping', () => {
  it('maps all API statuses to Box enum values', () => {
    expect(toBoxStatus('Uploaded')).toBe('uploaded');
    expect(toBoxStatus('Under_Review')).toBe('under_review');
    expect(toBoxStatus('Revision_Requested')).toBe('revision_requested');
    expect(toBoxStatus('Approved')).toBe('approved');
    expect(toBoxStatus('Waived')).toBe('waived');
    expect(toBoxStatus('Not_Requested')).toBe('pending_upload');
  });

  it('maps Box enum values back to API statuses', () => {
    expect(toApiStatus('uploaded')).toBe('Uploaded');
    expect(toApiStatus('under_review')).toBe('Under_Review');
    expect(toApiStatus('revision_requested')).toBe('Revision_Requested');
    expect(toApiStatus('approved')).toBe('Approved');
    expect(toApiStatus('waived')).toBe('Waived');
    expect(toApiStatus('pending_upload')).toBe('Not_Requested');
  });

  it('covers every API status in API_TO_BOX_STATUS', () => {
    const apiStatuses = [
      'Not_Requested',
      'Uploaded',
      'Under_Review',
      'Revision_Requested',
      'Approved',
      'Waived',
    ];
    for (const status of apiStatuses) {
      expect(API_TO_BOX_STATUS[status]).toBeDefined();
      expect(BOX_TO_API_STATUS[API_TO_BOX_STATUS[status]]).toBe(status);
    }
  });

  it('returns null for unknown Box status', () => {
    expect(toApiStatus('unknown_status')).toBeNull();
  });
});

describe('boxDocumentStatusService mergeWithBoxMetadata', () => {
  /** @type {BoxDocumentStatusService} */
  let service;

  beforeEach(() => {
    mockExecuteRead.mockReset();
    service = new BoxDocumentStatusService();
  });

  it('uses Box status when matched by fileId', async () => {
    mockExecuteRead.mockResolvedValue({
      entries: [{
        id: 'box-file-1',
        name: 'w2.pdf',
        metadata: {
          enterprise: {
            taxflow_document: {
              request_id: 'req-1',
              status: 'approved',
              review_comments: '',
            },
          },
        },
      }],
    });

    const dbDocs = [{
      id: 'req-1',
      fileId: 'box-file-1',
      name: 'W-2',
      status: 'Uploaded',
      clientId: 'client-1',
    }];

    const merged = await service.mergeWithBoxMetadata(dbDocs, 'client-1');
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('Approved');
    expect(merged[0].statusSource).toBe('box');
  });

  it('uses Box status when matched by request_id', async () => {
    mockExecuteRead.mockResolvedValue({
      entries: [{
        id: 'box-file-2',
        name: '1099.pdf',
        metadata: {
          enterprise: {
            taxflow_document: {
              request_id: 'req-2',
              status: 'under_review',
            },
          },
        },
      }],
    });

    const dbDocs = [{
      id: 'req-2',
      fileId: null,
      name: '1099',
      status: 'Uploaded',
      clientId: 'client-1',
    }];

    const merged = await service.mergeWithBoxMetadata(dbDocs, 'client-1');
    expect(merged[0].status).toBe('Under_Review');
    expect(merged[0].fileId).toBe('box-file-2');
    expect(merged[0].statusSource).toBe('box');
  });

  it('falls back to DB status when no Box match', async () => {
    mockExecuteRead.mockResolvedValue({ entries: [] });

    const dbDocs = [{
      id: 'req-3',
      name: 'Bank Statement',
      status: 'Not_Requested',
      clientId: 'client-1',
    }];

    const merged = await service.mergeWithBoxMetadata(dbDocs, 'client-1');
    expect(merged[0].status).toBe('Not_Requested');
    expect(merged[0].statusSource).toBe('db');
  });

  it('buildClientDocumentList includes pending Not_Requested rows without Box files', async () => {
    mockExecuteRead.mockResolvedValue({ entries: [] });

    const dbDocs = [
      { id: 'req-a', name: 'W-2', status: 'Not_Requested', isDraft: false, clientId: 'client-1' },
      { id: 'req-b', name: '1099', status: 'Not_Requested', isDraft: true, clientId: 'client-1' },
    ];

    const list = await service.buildClientDocumentList('client-1', dbDocs);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('req-a');
    expect(list[0].status).toBe('Not_Requested');
  });
});

describe('boxDocumentStatusService setFileStatus', () => {
  /** @type {BoxDocumentStatusService} */
  let service;

  beforeEach(() => {
    mockGetFileMetadataById.mockReset();
    mockUpdateFileMetadataById.mockReset();
    mockCreateFileMetadataById.mockReset();
    service = new BoxDocumentStatusService();
  });

  it('creates metadata when none exists', async () => {
    mockGetFileMetadataById.mockRejectedValue({ statusCode: 404 });
    mockCreateFileMetadataById.mockResolvedValue({});

    await service.setFileStatus('file-1', 'Under_Review', { reviewer: 'emp-1' });

    expect(mockCreateFileMetadataById).toHaveBeenCalled();
    expect(mockUpdateFileMetadataById).not.toHaveBeenCalled();
    const payload = mockCreateFileMetadataById.mock.calls[0][3];
    expect(payload.status).toBe('under_review');
    expect(payload.reviewer).toBe('emp-1');
  });

  it('adds missing reviewer path instead of replace-only', async () => {
    mockGetFileMetadataById.mockResolvedValue({ status: 'uploaded' });
    mockUpdateFileMetadataById.mockResolvedValue({});

    await service.setFileStatus('file-1', 'Under_Review', { reviewer: 'emp-1' });

    const ops = mockUpdateFileMetadataById.mock.calls[0][3];
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'replace', path: '/status', value: 'under_review' },
        { op: 'add', path: '/reviewer', value: 'emp-1' },
      ])
    );
  });

  it('normalizes Medium priority to normal enum', async () => {
    mockGetFileMetadataById.mockRejectedValue({ statusCode: 404 });
    mockCreateFileMetadataById.mockResolvedValue({});

    await service.setFileStatus('file-1', 'Uploaded', { priority: 'Medium' });

    const payload = mockCreateFileMetadataById.mock.calls[0][3];
    expect(payload.priority).toBe('normal');
  });
});
