// eslint-disable-next-line eslint-comments/disable-enable-pair -- [@vercel/style-guide@5 migration]
/* eslint-disable no-console */
// Run from the current directory, with:
// npx tsx -r dotenv/config script.mts dotenv_config_path=.env.local

import { createReadStream } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import { fetch } from 'undici';
import axios from 'axios';
import got from 'got';
import * as vercelBlob from '@vercel/blob';

console.log('=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*');
console.log('VERCEL BLOB SCRIPT DEMO');
console.log('=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*=*');
console.log();

async function run(): Promise<void> {
  const urls = await Promise.all([
    textFileExample(),
    textFileNoRandomSuffixExample(),
    textFileExampleWithCacheControlMaxAge(),
    imageExample(),
    videoExample(),
    webpageExample(),
    incomingMessageExample(),
    axiosExample(),
    gotExample(),
    fetchExample(),
    noExtensionExample(),
    weirdCharactersExample(),
    copyTextFile(),
    listFolders(),
    multipartNodeJsFileStream(),
    fetchExampleMultipart(),
    createFolder(),
    manualMultipartUpload(),
    manualMultipartUploader(),
  ]);

  // multipart uploads are frequently not immediately available so we have to wait a bit
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await Promise.all(
    urls.map(async (url) => {
      const blobDetails = await vercelBlob.head(url);
      console.log(blobDetails, url);
    }),
  );

  // list all blobs
  let count = 0;
  let hasMore = true;
  let cursor: string | undefined;
  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop -- [@vercel/style-guide@5 migration]
    const listResult = await vercelBlob.list({
      cursor,
    });
    hasMore = listResult.hasMore;
    cursor = listResult.cursor;
    count += listResult.blobs.length;
  }

  console.log(count, 'blobs in this store');

  await Promise.all(urls.map((url) => vercelBlob.del(url)));
}

async function textFileExample(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put('folderé/test.txt', 'Hello, world!', {
    access: 'public',
  });
  console.log('Text file example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function textFileNoRandomSuffixExample(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put(
    `folder/test${Date.now()}.txt`,
    'Hello, world!',
    {
      access: 'public',
      addRandomSuffix: false,
    },
  );
  console.log('Text file example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function textFileExampleWithCacheControlMaxAge(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put('folder/test.txt', 'Hello, world!', {
    access: 'public',
    cacheControlMaxAge: 120,
  });
  console.log('Text file example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function imageExample(): Promise<string> {
  const start = Date.now();
  const pathname = 'zeit.png';
  const fullPath = `public/${pathname}`;
  const stream = createReadStream(fullPath);

  stream.once('error', (error) => {
    throw error;
  });

  const blob = await vercelBlob.put(pathname, stream, {
    access: 'public',
  });

  console.log('Image example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function videoExample(): Promise<string> {
  const start = Date.now();
  const pathname = 'small-video.mp4';
  const fullPath = `public/${pathname}`;
  const stream = createReadStream(fullPath);

  stream.once('error', (error) => {
    throw error;
  });

  const blob = await vercelBlob.put(pathname, createReadStream(fullPath), {
    access: 'public',
  });

  console.log('Video example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function webpageExample(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put(
    'subfolder/another-folder/page.html',
    '<div>Hello from a webpage!</div>',
    {
      access: 'public',
    },
  );

  console.log('Webpage example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

// this example streams the response from a remote server to the blob store
async function incomingMessageExample(): Promise<string> {
  const start = Date.now();

  const incomingMessage: IncomingMessage = await new Promise((resolve) => {
    https.get(
      'https://example-files.online-convert.com/video/mp4/example.mp4',
      resolve,
    );
  });

  const blob = await vercelBlob.put('example.mp4', incomingMessage, {
    access: 'public',
  });

  console.log(
    'incomingMessage example:',
    blob.url,
    `(${Date.now() - start}ms)`,
  );
  return blob.url;
}

async function axiosExample(): Promise<string> {
  const start = Date.now();

  const response = await axios.get(
    'https://example-files.online-convert.com/video/mp4/example_2s.mp4',
    {
      responseType: 'stream',
    },
  );

  const blob = await vercelBlob.put(
    'example_2s.mp4',
    response.data as IncomingMessage,
    {
      access: 'public',
    },
  );

  console.log('axios example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function gotExample(): Promise<string> {
  const start = Date.now();

  const request = got.stream(
    'https://example-files.online-convert.com/video/mp4/example_2s.mp4',
  );

  const blob = await vercelBlob.put('example_2s.mp4', request, {
    access: 'public',
  });

  console.log('got example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function fetchExample(): Promise<string> {
  const start = Date.now();

  const response = await fetch(
    'https://example-files.online-convert.com/video/mp4/example_2s.mp4',
  );

  const blob = await vercelBlob.put(
    'example_2s.mp4',
    response.body as ReadableStream,
    {
      access: 'public',
    },
  );

  console.log('fetch example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

run().catch((err) => {
  throw err;
});

async function noExtensionExample(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put('folder/test something', 'Hello, world!', {
    access: 'public',
  });

  console.log('no extension example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function weirdCharactersExample(): Promise<string> {
  const start = Date.now();
  const blob = await vercelBlob.put(
    // certain characters will need to be encoded by the customer, for example if you want a literal %20 in the filename
    // encodeURI is the right way as we want to support '/' as the default delimiter
    encodeURI('folder/test %20yes.txt'),
    'Hello, world!',
    {
      access: 'public',
    },
  );

  console.log(
    'weird characters example:',
    blob.url,
    `(${Date.now() - start}ms)`,
  );
  return blob.url;
}

async function copyTextFile() {
  const start = Date.now();

  const blob = await vercelBlob.put('folder/test.txt', 'Hello, world!', {
    access: 'public',
    contentType: 'application/json',
    cacheControlMaxAge: 120,
  });

  const copiedBlob = await vercelBlob.copy(
    blob.url,
    `destination/copy${Date.now()}.txt`,
    {
      access: 'public',
    },
  );

  console.log(
    'copy blob example:',
    copiedBlob.url,
    `(${Date.now() - start}ms)`,
  );

  await vercelBlob.del(blob.url);

  return copiedBlob.url;
}

async function listFolders() {
  const start = Date.now();

  const blob = await vercelBlob.put('foo/bar.txt', 'Hello, world!', {
    access: 'public',
  });

  const response = await vercelBlob.list({
    mode: 'folded',
  });

  console.log('fold blobs example:', response, `(${Date.now() - start}ms)`);

  return blob.url;
}

async function multipartNodeJsFileStream() {
  const pathname = 'big-video.mp4';
  const fullPath = `public/${pathname}`;
  const stream = createReadStream(fullPath);
  stream.once('error', (error) => {
    console.log(error);
    throw error;
  });

  const start = Date.now();

  // testing with an accent
  const blob = await vercelBlob.put(`éllo/${pathname}`, stream, {
    access: 'public',
    multipart: true,
  });

  console.log(
    'Node.js multipart file stream example:',
    blob.url,
    `(${Date.now() - start}ms)`,
  );

  return blob.url;
}

async function fetchExampleMultipart(): Promise<string> {
  const start = Date.now();

  const response = await fetch(
    'https://example-files.online-convert.com/video/mp4/example_big.mp4',
  );

  const blob = await vercelBlob.put(
    'example_big.mp4',
    response.body as ReadableStream,
    {
      access: 'public',
      multipart: true,
    },
  );

  console.log('fetch example:', blob.url, `(${Date.now() - start}ms)`);
  return blob.url;
}

async function createFolder() {
  const start = Date.now();

  const blob = await vercelBlob.put(`foolder${Date.now()}/`, {
    access: 'public',
    addRandomSuffix: false,
  });

  console.log('create folder example:', blob, `(${Date.now() - start}ms)`);

  return blob.url;
}

async function manualMultipartUploader() {
  const start = Date.now();

  const pathname = 'big-text.txt';
  const fullPath = `public/${pathname}`;

  const uploader = await vercelBlob.createMultipartUploader('big-file-2.txt', {
    access: 'public',
  });

  const part1 = await uploader.uploadPart(1, createReadStream(fullPath));

  const part2 = await uploader.uploadPart(2, createReadStream(fullPath));

  const blob = await uploader.complete([part1, part2]);

  console.log(
    'manual multipart put with util:',
    blob,
    `(${Date.now() - start}ms)`,
  );

  return blob.url;
}

async function manualMultipartUpload() {
  const start = Date.now();

  const pathname = 'big-text.txt';
  const fullPath = `public/${pathname}`;

  const { key, uploadId } = await vercelBlob.createMultipartUpload(
    'big-file.txt',
    {
      access: 'public',
    },
  );

  const part1 = await vercelBlob.uploadPart(
    fullPath,
    createReadStream(fullPath),
    { access: 'public', key, uploadId, partNumber: 1 },
  );

  const part2 = await vercelBlob.uploadPart(
    fullPath,
    createReadStream(fullPath),
    { access: 'public', key, uploadId, partNumber: 2 },
  );

  const blob = await vercelBlob.completeMultipartUpload(
    fullPath,
    [part1, part2],
    { access: 'public', key, uploadId },
  );

  console.log('manual multipart put:', blob, `(${Date.now() - start}ms)`);

  return blob.url;
}
