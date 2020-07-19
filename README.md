# gcs-mutex-lock

Simple, scalable, distributed mutex for serialising computations that is backed by [GCS](https://cloud.google.com/storage).

## Installation

```sh
yarn add gcs-mux-lock
```

## Prerequisites

- You have a project in Google Cloud Platform.
- You have the [Google Cloud SDK](https://cloud.google.com/sdk/downloads) installed and configured.
- The Cloud Storage API in the [Google APIs Console](https://console.developers.google.com) is enabled.

## Setting up your bucket

1. Create a bucket in which to store your lock file - `gsutil mb gs://your-bucket-name`.
2. Enable object versioning in your bucket - `gsutil versioning set on gs://your-bucket-name`.
3. Set a lifetime for lock files in this bucket - `gsutil lifecycle set <config-json-file> gs://your-bucket-name`. See this [README](https://github.com/marcacohen/gcslock/blob/master/README.md#limitations-read-the-fine-print) for an explanation on this.

```json
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 1 }
    }
  ]
}
```

## Example Usage

```typescript
import MutexLock from 'gcs-mux-lock'

const lock = new MutexLock({
  /* @google-cloud/storage options for new Storage() */
  storageOptions: {},
  bucket: 'mutex-locks',
  object: 'my-lock',
})

await lock.aquire()

try {
  // serialised computation happens here.
} finally {
  lock.release()
}
```

## Custom Timeouts

```typescript
import MutexLock from 'gcs-mux-lock'

const lock = new MutexLock({
  timeoutOptions: {
    forever: false,
    minTimeout: 10,
    maxTimeout: 1000,
    retries: 10,
  },
})
```

**WARNING**: Failure to call release will hold the mutex and deadlock the application. Make sure to call release under all circumstances and handle exceptions accordingly.

## API

### `new Mutex(options: Object)`

Creates a new Mutex lock. See [types](https://github.com/TobyColeman/gcs-mutex-lock/src/index.ts) for a complete set of options. By default `aquire` and `release` will wait indefinitely when trying to acquire or relinquish a lock. For convenience you can configure timeouts, backoff behaviour, retries etc.

### `mutex.aquire()`

Returns a promise that will resolve as soon as the mutex is locked. If the lock is already in use then `aquire()` will wait until the mutex is available.

### `mutex.release()`

Returns a promise that will resolve as soon as the mutex is unlocked. If the lock doesn't exist upon calling `release()` an error will be thrown, otherwise `release()` will wait until the mutex is unlocked.

## Acknowledgements

This project is basically a port of Marc Cohen's [gcslock](<(https://github.com/marcacohen/gcslock)>) library. I recommend reading their project's README for a better understanding of the [limitations](https://github.com/marcacohen/gcslock/blob/master/README.md#limitations-read-the-fine-print).
