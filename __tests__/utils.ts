import { Storage } from '@google-cloud/storage'
import { MutexLockOptions } from '../src'

export interface TestConfig {
  lockOptions: MutexLockOptions
}

export const provideTestConfig = (): TestConfig => {
  require('dotenv').config() // eslint-disable-line
  return {
    lockOptions: {
      storageOptions: {
        projectId: process.env.PROJECT_ID as string,
        keyFilename: process.env.KEY_FILENAME as string,
      },
      bucket: 'tmp_mutex_lock',
      object: 'TEST_LOCK_FILE',
    },
  }
}

export const cleanupBucket = async (): Promise<void> => {
  const testConfig = provideTestConfig()
  const storage = new Storage({
    ...testConfig.lockOptions.storageOptions,
    autoRetry: false,
    maxRetries: 1,
  })
  await storage.bucket(testConfig.lockOptions.bucket).deleteFiles()
}

export const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
