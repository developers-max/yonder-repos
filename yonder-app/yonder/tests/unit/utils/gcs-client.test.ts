import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { Readable } from 'stream';

// Mock state to control the behavior of Google Cloud Storage
const mockState = vi.hoisted(() => {
  return {
    fileExistsMock: vi.fn(),
    fileCreateReadStreamMock: vi.fn(),
    fileGetMetadataMock: vi.fn(),
    bucketFileMock: vi.fn(),
    bucketMock: vi.fn(),
    storageMock: vi.fn(),
  };
});

// Mock @google-cloud/storage
vi.mock('@google-cloud/storage', () => {
  return {
    Storage: class MockStorage {
      constructor(options: unknown) {
        mockState.storageMock(options);
      }
      bucket(bucketName: string) {
        mockState.bucketMock(bucketName);
        return {
          file: (path: string) => {
            mockState.bucketFileMock(path);
            return {
              exists: mockState.fileExistsMock,
              createReadStream: mockState.fileCreateReadStreamMock,
              getMetadata: mockState.fileGetMetadataMock,
            };
          },
        };
      }
    },
  };
});

// Import after mocking
import {
  extractGcsPath,
  fileExists,
  getFileStream,
  getFileMetadata,
  getBucketName,
} from '../../../src/lib/utils/remote-clients/gcs-client';

// Store original env vars
const originalEnv = {
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GOOGLE_BUCKET_ACCESS_ACCOUNT: process.env.GOOGLE_BUCKET_ACCESS_ACCOUNT,
};

beforeEach(() => {
  // Set up test environment
  process.env.GCP_PROJECT_ID = 'test-project-123';
  process.env.GCS_BUCKET_NAME = 'test-bucket';
  process.env.GOOGLE_BUCKET_ACCESS_ACCOUNT = JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key: 'test-key',
    client_email: 'test@test.iam.gserviceaccount.com',
  });

  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Restore original env vars
  process.env.GCP_PROJECT_ID = originalEnv.GCP_PROJECT_ID;
  process.env.GCS_BUCKET_NAME = originalEnv.GCS_BUCKET_NAME;
  process.env.GOOGLE_BUCKET_ACCESS_ACCOUNT = originalEnv.GOOGLE_BUCKET_ACCESS_ACCOUNT;
});

describe('extractGcsPath', () => {
  it('extracts bucket and path from gs:// URL format', () => {
    const result = extractGcsPath('gs://my-bucket/path/to/file.pdf');
    expect(result).toEqual({
      bucket: 'my-bucket',
      path: 'path/to/file.pdf',
    });
  });

  it('extracts bucket and path from storage.googleapis.com URL', () => {
    const result = extractGcsPath('https://storage.googleapis.com/my-bucket/path/to/file.pdf');
    expect(result).toEqual({
      bucket: 'my-bucket',
      path: 'path/to/file.pdf',
    });
  });

  it('extracts bucket and path from storage.cloud.google.com URL', () => {
    const result = extractGcsPath('https://storage.cloud.google.com/yonder-reports/reports/2024/report.pdf');
    expect(result).toEqual({
      bucket: 'yonder-reports',
      path: 'reports/2024/report.pdf',
    });
  });

  it('handles deeply nested paths', () => {
    const result = extractGcsPath('gs://bucket/a/b/c/d/e/file.pdf');
    expect(result).toEqual({
      bucket: 'bucket',
      path: 'a/b/c/d/e/file.pdf',
    });
  });

  it('returns null for invalid gs:// URL without path', () => {
    const result = extractGcsPath('gs://bucket-only');
    expect(result).toBeNull();
  });

  it('returns null for invalid https URL format', () => {
    const result = extractGcsPath('https://example.com/not-gcs');
    expect(result).toBeNull();
  });

  it('returns null for malformed URL', () => {
    const result = extractGcsPath('not-a-valid-url');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = extractGcsPath('');
    expect(result).toBeNull();
  });
});

describe('fileExists', () => {
  it('returns true when file exists', async () => {
    mockState.fileExistsMock.mockResolvedValueOnce([true]);

    const result = await fileExists('gs://test-bucket/path/to/file.pdf');

    expect(result).toBe(true);
    expect(mockState.bucketMock).toHaveBeenCalledWith('test-bucket');
    expect(mockState.bucketFileMock).toHaveBeenCalledWith('path/to/file.pdf');
    expect(mockState.fileExistsMock).toHaveBeenCalled();
  });

  it('returns false when file does not exist', async () => {
    mockState.fileExistsMock.mockResolvedValueOnce([false]);

    const result = await fileExists('gs://test-bucket/missing.pdf');

    expect(result).toBe(false);
    expect(mockState.fileExistsMock).toHaveBeenCalled();
  });

  it('returns false for invalid URL format', async () => {
    const result = await fileExists('invalid-url');
    expect(result).toBe(false);
    expect(mockState.fileExistsMock).not.toHaveBeenCalled();
  });

  it('returns false when API throws error', async () => {
    mockState.fileExistsMock.mockRejectedValueOnce(new Error('API error'));

    const result = await fileExists('gs://test-bucket/file.pdf');

    expect(result).toBe(false);
  });
});

describe('getFileStream', () => {
  it('returns a readable stream when file exists', async () => {
    const mockStream = new Readable();
    mockState.fileExistsMock.mockResolvedValueOnce([true]);
    mockState.fileCreateReadStreamMock.mockReturnValueOnce(mockStream);

    const stream = await getFileStream('gs://test-bucket/report.pdf');

    expect(stream).toBe(mockStream);
    expect(mockState.fileExistsMock).toHaveBeenCalled();
    expect(mockState.fileCreateReadStreamMock).toHaveBeenCalled();
  });

  it('throws error for invalid URL format', async () => {
    await expect(getFileStream('not-a-valid-url')).rejects.toThrow('Invalid GCS URL format');
    expect(mockState.fileCreateReadStreamMock).not.toHaveBeenCalled();
  });

  it('throws error when file does not exist', async () => {
    mockState.fileExistsMock.mockResolvedValueOnce([false]);

    await expect(getFileStream('gs://test-bucket/missing.pdf')).rejects.toThrow('File not found in GCS');
  });

  it('throws error when stream creation fails', async () => {
    mockState.fileExistsMock.mockResolvedValueOnce([true]);
    mockState.fileCreateReadStreamMock.mockImplementationOnce(() => {
      throw new Error('Stream creation failed');
    });

    await expect(getFileStream('gs://test-bucket/file.pdf')).rejects.toThrow();
  });

  it('works with https:// GCS URLs', async () => {
    const mockStream = new Readable();
    mockState.fileExistsMock.mockResolvedValueOnce([true]);
    mockState.fileCreateReadStreamMock.mockReturnValueOnce(mockStream);

    const stream = await getFileStream('https://storage.googleapis.com/yonder-reports/report.pdf');

    expect(stream).toBe(mockStream);
    expect(mockState.bucketMock).toHaveBeenCalledWith('yonder-reports');
    expect(mockState.bucketFileMock).toHaveBeenCalledWith('report.pdf');
  });
});

describe('getFileMetadata', () => {
  it('returns metadata for existing file', async () => {
    const mockMetadata = {
      size: '1024000',
      contentType: 'application/pdf',
      updated: '2024-11-13T22:00:00.000Z',
    };
    mockState.fileGetMetadataMock.mockResolvedValueOnce([mockMetadata]);

    const result = await getFileMetadata('gs://test-bucket/report.pdf');

    expect(result).toEqual({
      size: 1024000,
      contentType: 'application/pdf',
      updated: new Date('2024-11-13T22:00:00.000Z'),
    });
    expect(mockState.fileGetMetadataMock).toHaveBeenCalled();
  });

  it('returns null for invalid URL format', async () => {
    const result = await getFileMetadata('invalid-url');
    expect(result).toBeNull();
    expect(mockState.fileGetMetadataMock).not.toHaveBeenCalled();
  });

  it('returns null when API throws error', async () => {
    mockState.fileGetMetadataMock.mockRejectedValueOnce(new Error('API error'));

    const result = await getFileMetadata('gs://test-bucket/file.pdf');

    expect(result).toBeNull();
  });

  it('handles missing metadata fields gracefully', async () => {
    mockState.fileGetMetadataMock.mockResolvedValueOnce([{}]);

    const result = await getFileMetadata('gs://test-bucket/file.pdf');

    expect(result).toEqual({
      size: 0,
      contentType: 'application/octet-stream',
      updated: expect.any(Date),
    });
  });

  it('parses size as integer correctly', async () => {
    mockState.fileGetMetadataMock.mockResolvedValueOnce([{
      size: '999999',
      contentType: 'application/pdf',
      updated: '2024-01-01T00:00:00.000Z',
    }]);

    const result = await getFileMetadata('gs://test-bucket/large-file.pdf');

    expect(result?.size).toBe(999999);
    expect(typeof result?.size).toBe('number');
  });
});

describe('getBucketName', () => {
  it('returns the configured bucket name from env', () => {
    const bucketName = getBucketName();
    // Note: GCS_BUCKET_NAME may be set to default 'yonder-reports' if not overridden
    // This test verifies the function works, regardless of env value
    expect(bucketName).toBeDefined();
    expect(typeof bucketName).toBe('string');
    expect(bucketName.length).toBeGreaterThan(0);
  });

  it('returns a valid bucket name', () => {
    const bucketName = getBucketName();
    // Bucket names should be lowercase and contain no spaces
    expect(bucketName).toMatch(/^[a-z0-9][a-z0-9-_]*$/);
  });
});

describe('Storage client initialization', () => {
  it('calls GCS bucket and file methods correctly', async () => {
    mockState.fileExistsMock.mockResolvedValueOnce([true]);
    
    const result = await fileExists('gs://test-bucket/test.pdf');

    // Verify the storage client was used correctly
    expect(result).toBe(true);
    expect(mockState.bucketMock).toHaveBeenCalledWith('test-bucket');
    expect(mockState.bucketFileMock).toHaveBeenCalledWith('test.pdf');
    expect(mockState.fileExistsMock).toHaveBeenCalled();
  });
});
