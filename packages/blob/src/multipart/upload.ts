import bytes from 'bytes';
import type { BodyInit } from 'undici';
import { BlobServiceNotAvailable, requestApi } from '../api';
import { debug } from '../debug';
import type { CommonCreateBlobOptions, BlobCommandOptions } from '../helpers';
import { createPutHeaders, createPutOptions } from '../put-helpers';
import type { PutBody, CreatePutMethodOptions } from '../put-helpers';
import type { Part, PartInput } from './helpers';

// shared interface for server and client
export interface CommonMultipartUploadOptions {
  uploadId: string;
  key: string;
  partNumber: number;
  abortController?: AbortController;
}

export type UploadPartCommandOptions = CommonMultipartUploadOptions &
  CommonCreateBlobOptions;

export function createUploadPartMethod<
  TOptions extends UploadPartCommandOptions,
>({ allowedOptions, getToken, extraChecks }: CreatePutMethodOptions<TOptions>) {
  return async (
    pathname: string,
    body: PutBody,
    optionsInput: TOptions,
  ): Promise<Part> => {
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken,
    });

    const headers = createPutHeaders(allowedOptions, options);

    const result = await uploadPart({
      uploadId: options.uploadId,
      key: options.key,
      pathname,
      part: { blob: body, partNumber: options.partNumber },
      headers,
      options,
      abortController: options.abortController,
    });

    return {
      etag: result.etag,
      partNumber: options.partNumber,
    };
  };
}

export function uploadPart({
  uploadId,
  key,
  pathname,
  headers,
  options,
  abortController,
  part,
}: {
  uploadId: string;
  key: string;
  pathname: string;
  headers: Record<string, string>;
  options: BlobCommandOptions;
  abortController?: AbortController;
  part: PartInput;
}): Promise<UploadPartApiResponse> {
  return requestApi<UploadPartApiResponse>(
    `/mpu/${pathname}`,
    {
      signal: abortController?.signal,
      method: 'POST',
      headers: {
        ...headers,
        'x-mpu-action': 'upload',
        'x-mpu-key': encodeURI(key),
        'x-mpu-upload-id': uploadId,
        'x-mpu-part-number': part.partNumber.toString(),
      },
      // weird things between undici types and native fetch types
      body: part.blob as BodyInit,
      // required in order to stream some body types to Cloudflare
      // currently only supported in Node.js, we may have to feature detect this
      // note: this doesn't send a content-length to the server
      duplex: 'half',
    },
    options,
  );
}

// Most browsers will cap requests at 6 concurrent uploads per domain (Vercel Blob API domain)
// In other environments, we can afford to be more aggressive
const maxConcurrentUploads = typeof window !== 'undefined' ? 6 : 8;

// 5MB is the minimum part size accepted by Vercel Blob, but we set our default part size to 8mb like the aws cli
const partSizeInBytes = 8 * 1024 * 1024;

const maxBytesInMemory = maxConcurrentUploads * partSizeInBytes * 2;

interface UploadPartApiResponse {
  etag: string;
}

export interface BlobUploadPart {
  partNumber: number;
  blob: Blob;
}

// Can we rewrite this function without new Promise?
export function uploadAllParts({
  uploadId,
  key,
  pathname,
  stream,
  headers,
  options,
}: {
  uploadId: string;
  key: string;
  pathname: string;
  stream: ReadableStream<ArrayBuffer>;
  headers: Record<string, string>;
  options: BlobCommandOptions;
}): Promise<Part[]> {
  debug('mpu: upload init', 'key:', key);
  const internalAbortController = new AbortController();

  return new Promise((resolve, reject) => {
    const partsToUpload: BlobUploadPart[] = [];
    const completedParts: Part[] = [];
    const reader = stream.getReader();
    let activeUploads = 0;
    let reading = false;
    let currentPartNumber = 1;
    // this next variable is used to escape the read loop when an error occurs
    let rejected = false;
    let currentBytesInMemory = 0;
    let doneReading = false;
    let bytesSent = 0;

    // This must be outside the read loop, in case we reach the maxBytesInMemory and
    // we exit the loop but some bytes are still to be sent on the next read invocation.
    let arrayBuffers: ArrayBuffer[] = [];
    let currentPartBytesRead = 0;

    read().catch(cancel);

    async function read(): Promise<void> {
      debug(
        'mpu: upload read start',
        'activeUploads:',
        activeUploads,
        'currentBytesInMemory:',
        `${bytes(currentBytesInMemory)}/${bytes(maxBytesInMemory)}`,
        'bytesSent:',
        bytes(bytesSent),
      );

      reading = true;

      while (currentBytesInMemory < maxBytesInMemory && !rejected) {
        try {
          // eslint-disable-next-line no-await-in-loop -- A for loop is fine here.
          const { value, done } = await reader.read();

          if (done) {
            doneReading = true;
            debug('mpu: upload read consumed the whole stream');
            // done is sent when the stream is fully consumed. That's why we're not using the value here.
            if (arrayBuffers.length > 0) {
              partsToUpload.push({
                partNumber: currentPartNumber++,
                blob: new Blob(arrayBuffers, {
                  type: 'application/octet-stream',
                }),
              });

              sendParts();
            }
            reading = false;
            return;
          }

          currentBytesInMemory += value.byteLength;

          // This code ensures that each part will be exactly of `partSizeInBytes` size
          // Otherwise R2 will refuse it. AWS S3 is fine with parts of different sizes.
          let valueOffset = 0;
          while (valueOffset < value.byteLength) {
            const remainingPartSize = partSizeInBytes - currentPartBytesRead;
            const endOffset = Math.min(
              valueOffset + remainingPartSize,
              value.byteLength,
            );

            const chunk = value.slice(valueOffset, endOffset);

            arrayBuffers.push(chunk);
            currentPartBytesRead += chunk.byteLength;
            valueOffset = endOffset;

            if (currentPartBytesRead === partSizeInBytes) {
              partsToUpload.push({
                partNumber: currentPartNumber++,
                blob: new Blob(arrayBuffers, {
                  type: 'application/octet-stream',
                }),
              });

              arrayBuffers = [];
              currentPartBytesRead = 0;
              sendParts();
            }
          }
        } catch (error) {
          cancel(error);
        }
      }

      debug(
        'mpu: upload read end',
        'activeUploads:',
        activeUploads,
        'currentBytesInMemory:',
        `${bytes(currentBytesInMemory)}/${bytes(maxBytesInMemory)}`,
        'bytesSent:',
        bytes(bytesSent),
      );

      reading = false;
    }

    async function sendPart(part: BlobUploadPart): Promise<void> {
      activeUploads++;

      debug(
        'mpu: upload send part start',
        'partNumber:',
        part.partNumber,
        'size:',
        part.blob.size,
        'activeUploads:',
        activeUploads,
        'currentBytesInMemory:',
        `${bytes(currentBytesInMemory)}/${bytes(maxBytesInMemory)}`,
        'bytesSent:',
        bytes(bytesSent),
      );

      try {
        const completedPart = await uploadPart({
          uploadId,
          key,
          pathname,
          headers,
          options,
          abortController: internalAbortController,
          part,
        });

        debug(
          'mpu: upload send part end',
          'partNumber:',
          part.partNumber,
          'activeUploads',
          activeUploads,
          'currentBytesInMemory:',
          `${bytes(currentBytesInMemory)}/${bytes(maxBytesInMemory)}`,
          'bytesSent:',
          bytes(bytesSent),
        );

        if (rejected) {
          return;
        }

        completedParts.push({
          partNumber: part.partNumber,
          etag: completedPart.etag,
        });

        currentBytesInMemory -= part.blob.size;
        activeUploads--;
        bytesSent += part.blob.size;

        if (partsToUpload.length > 0) {
          sendParts();
        }

        if (doneReading) {
          if (activeUploads === 0) {
            reader.releaseLock();
            resolve(completedParts);
          }
          return;
        }

        if (!reading) {
          read().catch(cancel);
        }
      } catch (error) {
        cancel(error);
      }
    }

    function sendParts(): void {
      if (rejected) {
        return;
      }

      debug(
        'send parts',
        'activeUploads',
        activeUploads,
        'partsToUpload',
        partsToUpload.length,
      );

      while (activeUploads < maxConcurrentUploads && partsToUpload.length > 0) {
        const partToSend = partsToUpload.shift();
        if (partToSend) {
          void sendPart(partToSend);
        }
      }
    }

    function cancel(error: unknown): void {
      // a previous call already rejected the whole call, ignore
      if (rejected) {
        return;
      }
      rejected = true;
      internalAbortController.abort();
      reader.releaseLock();
      if (
        error instanceof TypeError &&
        (error.message === 'Failed to fetch' ||
          error.message === 'fetch failed')
      ) {
        reject(new BlobServiceNotAvailable());
      } else {
        reject(error as Error);
      }
    }
  });
}
