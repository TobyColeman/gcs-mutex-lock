import { Storage, StorageOptions } from '@google-cloud/storage'
import promiseRetry = require('promise-retry')

export interface MutexLock {
  aquire: () => Promise<void>
  release: () => Promise<void>
}

export interface MutexLockOptions {
  storageOptions?: StorageOptions
  timeoutOptions?: TimeoutOptions
  bucket: string
  object: string
}

export interface TimeoutOptions {
  forever?: boolean
  retries?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
}

const DEFAULT_TIMEOUT_OPTIONS = {
  forever: true,
  factor: 3, // exponential factor
  minTimeout: 1000, // 1 second,
  maxTimeout: 60 * 1000, // 1 minute,
  randomize: true, //Randomizes the timeouts by multiplying with a factor between 1 to 2
}

export default class GcsMutexLock implements MutexLock {
  public isLocked: boolean

  private storage: Storage
  private timeoutOptions: TimeoutOptions
  private bucket: string
  private object: string

  constructor({
    storageOptions = {},
    timeoutOptions = {},
    bucket,
    object,
  }: MutexLockOptions) {
    this.storage = new Storage({
      ...storageOptions,
      autoRetry: false,
      maxRetries: 1,
    })
    this.timeoutOptions = { ...DEFAULT_TIMEOUT_OPTIONS, ...timeoutOptions }
    this.bucket = bucket
    this.object = object
    this.isLocked = false
  }

  async aquire(): Promise<void> {
    await promiseRetry(async (retry: (err: any) => void) => {
      await this.storage
        .bucket(this.bucket)
        .file(this.object, { generation: 0 })
        .save('', { resumable: false })
        .catch(retry)
    }, this.timeoutOptions)

    this.isLocked = true
  }

  async release(): Promise<void> {
    await promiseRetry(async (retry: (err: any) => void) => {
      await this.storage
        .bucket(this.bucket)
        .file(this.object)
        .delete()
        .catch((reason: any) => {
          if (
            reason &&
            typeof reason === 'object' &&
            reason.hasOwnProperty('message') &&
            typeof reason.message === 'string' &&
            reason.message.startsWith('No such object')
          ) {
            throw new Error('Lock does not exist')
          }
          retry(reason)
        })
    }, this.timeoutOptions)

    this.isLocked = false
  }
}
