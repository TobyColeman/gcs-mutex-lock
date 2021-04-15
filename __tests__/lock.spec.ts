import MutexLock from '../src'
import { provideTestConfig, cleanupBucket, TestConfig } from './utils'

let lock: MutexLock
let testConfig: TestConfig

// TODO: improve tests... mocking integration with GCS
// would make for some nicer testing of timeouts/retries

describe('With the default configuration', () => {
  beforeEach(async () => {
    testConfig = provideTestConfig()
    lock = new MutexLock(testConfig.lockOptions)
    await cleanupBucket()
  })
  afterAll(async () => {
    await cleanupBucket()
  })

  test('Should acquire a lock', async () => {
    return expect(lock.acquire()).resolves.toEqual({
      success: true,
      err: undefined,
    })
  })

  test('Should release a lock', async () => {
    await lock.acquire()
    return expect(lock.release()).resolves.toEqual({
      success: true,
      err: undefined,
    })
  })

  describe('When locked', () => {
    test('Should throw an error when trying to release a non-existent lock', async () => {
      ;(lock as any)._isLocked = true
      ;(lock as any).timeout = 100
      const { success, err } = await lock.release()

      expect(success).toEqual(false)
      expect(err).toBeDefined()
    })
  })

  describe('When unlocked', () => {
    test('Should do nothing when trying to release a non-existent lock', async () => {
      return expect(lock.release()).resolves.toEqual({
        success: true,
        err: undefined,
      })
    })
  })
})

describe('With custom configuration', () => {
  beforeEach(async () => {
    testConfig = provideTestConfig()
    lock = new MutexLock({
      ...testConfig.lockOptions,
      timeout: 500,
    })
    await cleanupBucket()
  })
  afterAll(async () => {
    await cleanupBucket()
  })

  test('Should fail to acquire an already acquired lock after 1 retry', async () => {
    // Not an amazing test, but trying to acquire an already acquired lock should not
    // throw an exception
    await lock.acquire()
    const { success, err } = await lock.acquire()
    expect(success).toEqual(false)
    expect(err).toBeDefined()
    expect(err.message).toEqual('Precondition Failed')
  })
})
