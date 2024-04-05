// common util interface for blob raw commands, not meant to be used directly
// this is why it's not exported from index/client

export interface BlobCommandOptions {
  /**
   * Define your blob API token.
   * @defaultvalue process.env.BLOB_READ_WRITE_TOKEN
   */
  token?: string;
  /**
   * Abortsignal to cancel the running request.
   */
  abortSignal?: AbortSignal;
}

// shared interface for put, copy and multipartUpload
export interface CommonCreateBlobOptions extends BlobCommandOptions {
  /**
   * Whether the blob should be publicly accessible. Support for private blobs is planned.
   */
  access: 'public';
  /**
   * Adds a random suffix to the filename.
   * @defaultvalue true
   */
  addRandomSuffix?: boolean;
  /**
   * Defines the content type of the blob. By default, this value is inferred from the pathname. Sent as the 'content-type' header when downloading a blob.
   */
  contentType?: string;
  /**
   * Number in seconds to configure the edge and browser cache. The maximum values are 5 minutes for the edge cache and unlimited for the browser cache.
   * Detailed documentation can be found here: https://vercel.com/docs/storage/vercel-blob#caching
   * @defaultvalue 365 * 24 * 60 * 60 (1 Year)
   */
  cacheControlMaxAge?: number;
}

export function getTokenFromOptionsOrEnv(options?: BlobCommandOptions): string {
  if (options?.token) {
    return options.token;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  throw new BlobError(
    'No token found. Either configure the `BLOB_READ_WRITE_TOKEN` environment variable, or pass a `token` option to your calls.',
  );
}

export class BlobError extends Error {
  constructor(message: string) {
    super(`Vercel Blob: ${message}`);
  }
}

export function getDownloadUrl(blobUrl: string): string {
  const url = new URL(blobUrl);

  url.searchParams.set('download', '1');

  return url.toString();
}
