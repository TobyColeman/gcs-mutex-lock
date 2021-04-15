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

export default class GcsMutexLock implements MutexLock {
  private _isLocked: boolean
  private storage: Storage
  private retryOptions: {
    forever: boolean
    minTimeout: number
    maxTimeout: number
    randomize: boolean
  }
  private timeout: number
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
    this.retryOptions = {
      // Open issue with setting a high number of retries -
      // https://github.com/IndigoUnited/node-promise-retry/issues/20
      forever: true,
      randomize: false,
      minTimeout: 100, // 100ms
      maxTimeout: 5000, // 5 seconds
    }
    this.timeout = timeout || Infinity
    this.bucket = bucket
    this.object = object
    this._isLocked = false
  }

  get isLocked(): boolean {
    return this._isLocked
  }

  async acquire(): Promise<MutexResult> {
    const then = new Date().getTime()

    try {
      await promiseRetry(async (retry: (err: any) => void) => {
        await this.storage
          .bucket(this.bucket)
          .file(this.object, { generation: 0 })
          .save('', { resumable: false })
          .catch((err) => {
            const now = new Date().getTime()

            if (now - then >= this.timeout) {
              throw err
            }

            retry(err)
          })
      }, this.retryOptions)
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
    const then = new Date().getTime()

    try {
      await promiseRetry(async (retry: (err: any) => void) => {
        await this.storage
          .bucket(this.bucket)
          .file(this.object)
          .delete()
          .catch((err) => {
            const now = new Date().getTime()

            if (now - then >= this.timeout) {
              throw err
            }

            retry(err)
          })
      }, this.retryOptions)
      this._isLocked = false
      return { success: true }
    } catch (err) {
      return { success: false, err }
    }
  }
}
