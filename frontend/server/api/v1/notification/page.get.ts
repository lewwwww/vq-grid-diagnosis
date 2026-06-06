import { NotificationDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const size = parseInt(query.size as string) || 10
  const recipientUsername = query.recipientUsername as string | undefined

  let records = NotificationDB.getAll()
  if (recipientUsername) {
    records = records.filter(record => record.recipientUsername === recipientUsername)
  }

  const total = records.length
  const pagedRecords = records.slice((page - 1) * size, page * size)

  return {
    code: 200,
    message: 'success',
    data: {
      records: pagedRecords,
      total,
      page,
      size
    }
  }
})
