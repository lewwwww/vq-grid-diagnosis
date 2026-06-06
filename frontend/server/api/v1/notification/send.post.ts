import { sendSystemNotifications } from '~/server/utils/notifications'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    alertId,
    deviceId,
    deviceName,
    type,
    content,
    recipientIds,
    senderId,
    senderUsername,
    senderName
  } = body || {}

  if (!deviceName || !content) {
    return { code: 400, message: '通知内容不完整', data: null }
  }

  const result = sendSystemNotifications({
    alertId: alertId ?? null,
    deviceId: deviceId ?? null,
    deviceName,
    type: type || '系统通知',
    content,
    recipientIds: Array.isArray(recipientIds) ? recipientIds : undefined,
    senderId: senderId ?? null,
    senderUsername: senderUsername || 'system',
    senderName: senderName || '系统'
  })

  if (result.blocked) {
    return {
      code: 200,
      message: result.reason,
      data: {
        blocked: true,
        count: 0,
        recipients: []
      }
    }
  }

  return {
    code: 200,
    message: '通知发送成功',
    data: {
      blocked: false,
      count: result.records.length,
      recipients: result.records.map(record => record.recipientName)
    }
  }
})
