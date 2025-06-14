import { join } from 'node:path'
import * as mime from 'mime-types'
import { readdir } from 'node:fs/promises'

const upload = async (directory: string) => {
  const client = new Bun.S3Client({
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
    endpoint: process.env.MINIO_ENDPOINT!,
    bucket: process.env.MINIO_BUCKET!
  })

  const files = await readdir(directory)
  const relevantFiles = files.filter(
    (file) =>
      file.endsWith('.exe') ||
      file.endsWith('.dmg') ||
      file.endsWith('.AppImage') ||
      file.endsWith('.yml')
  )

  await Promise.all(
    relevantFiles.map(async (file) => {
      const fullPath = join(directory, file)
      const contentType = mime.lookup(file) || 'application/octet-stream'

      try {
        await client.write(file, Bun.file(fullPath), {
          type: contentType,
          acl: 'public-read'
        })
        console.log(`uploaded: ${file}`)
      } catch (err) {
        console.error(`failed to upload ${file}:`, err)
      }
    })
  )
}
upload('./dist').catch(console.error)
