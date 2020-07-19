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

  test('Should aquire a lock', async () => {
    return expect(lock.aquire()).resolves.toEqual(undefined)
  })

  test('Should release a lock', async () => {
    await lock.aquire()
    return expect(lock.release()).resolves.toEqual(undefined)
  })

  test('Should throw an error when trying to release a non-existent lock', async () => {
    return expect(lock.release()).rejects.toThrow(/^Lock does not exist/)
  })
})

describe('With custom configuration', () => {
  beforeEach(async () => {
    testConfig = provideTestConfig()
    lock = new MutexLock({
      ...testConfig.lockOptions,
      timeoutOptions: {
        forever: false,
        minTimeout: 10,
        maxTimeout: 100,
        retries: 2,
      },
    })
    await cleanupBucket()
  })
  afterAll(async () => {
    await cleanupBucket()
  })

  test('Should fail to aquire an already aquired lock after 1 retry', async () => {
    // Not an amazing test, but trying to aquire an already aquired lock should not
    // throw an exception
    await lock.aquire()
    return expect(lock.aquire()).rejects.toThrow('Precondition Failed')
  })
})
