import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineEventHandler(async () => {
  const jsonPath = resolve(
    process.cwd(),
    '../data_new/models/fault_6class/codebook_map.json'
  )
  try {
    const raw = readFileSync(jsonPath, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    throw createError({ statusCode: 500, message: '无法读取码本映射表' })
  }
})

