import { Storage, StorageOptions } from '@google-cloud/storage'
import promiseRetry = require('promise-retry')

export type MutexResult = { success: boolean; err?: any }

export interface MutexLock {
  isLocked: boolean
  acquire: () => Promise<MutexResult>
  release: () => Promise<MutexResult>
}

export interface MutexLockOptions {
  storageOptions?: StorageOptions
  timeout?: number
  bucket: string
  object: string
}

const DEFAULT_RETRY_INTERVAL = 5000 // 5 seconds

export default class GcsMutexLock implements MutexLock {
  private _isLocked: boolean
  private storage: Storage
  private timeoutOptions: {
    forever?: boolean
    retries?: number
    minTimeout?: number
    maxTimeout?: number
    randomize?: boolean
  }
  private bucket: string
  private object: string

  constructor({
    storageOptions = {},
    timeout,
    bucket,
    object,
  }: MutexLockOptions) {
    this.storage = new Storage({
      ...storageOptions,
      autoRetry: false,
      maxRetries: 1,
    })
    this.timeoutOptions = timeout
      ? {
          forever: false,
          randomize: false,
          retries: 1,
          minTimeout: timeout,
          maxTimeout: timeout,
        }
      : {
          forever: true,
          randomize: false,
          minTimeout: timeout || DEFAULT_RETRY_INTERVAL,
          maxTimeout: timeout || DEFAULT_RETRY_INTERVAL,
        }
    this.bucket = bucket
    this.object = object
    this._isLocked = false
  }

  get isLocked(): boolean {
    return this._isLocked
  }

  async acquire(): Promise<MutexResult> {
    try {
      await promiseRetry(async (retry: (err: any) => void) => {
        await this.storage
          .bucket(this.bucket)
          .file(this.object, { generation: 0 })
          .save('', { resumable: false })
          .catch(retry)
      }, this.timeoutOptions)
      this._isLocked = true
      return { success: true }
    } catch (err) {
      return { success: false, err }
    }
  }

  async release(): Promise<MutexResult> {
    if (!this.isLocked) {
      return { success: true }
    }

    try {
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
      this._isLocked = false
      return { success: true }
    } catch (err) {
      return { success: false, err }
    }
  }
}
