require('dotenv').config() // eslint-disable-line
import GcsMutexLock from '../src/index'

const lock = new GcsMutexLock({
  storageOptions: {
    projectId: process.env.PROJECT_ID as string,
    keyFilename: process.env.KEY_FILENAME as string,
  },
  bucket: 'tmp_mutex_lock',
  object: 'EXAMPLE_LOCK_FILE',
  timeout: 5000,
})

async function main() {
  const { success, err } = await lock.acquire()

  if (!success) {
    console.error('Error acquiring lock', err)
    return
  }

  try {
    console.log('LOCK ACQUIRED - WORKING :)')
  } finally {
    await lock.release()
  }
}

main()
