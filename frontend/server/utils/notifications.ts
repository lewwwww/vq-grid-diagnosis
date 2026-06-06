import { NotificationDB, UserDB, logInfo } from '~/server/data/database'
import { getStore } from '~/server/data/store'

interface SendSystemNotificationOptions {
  alertId?: number | null
  deviceId?: number | null
  deviceName: string
  type?: string
  content: string
  recipientIds?: number[]
  senderId?: number | null
  senderUsername?: string
  senderName?: string
  includeSender?: boolean
}

function getNowString() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')
}

export function sendSystemNotifications(options: SendSystemNotificationOptions) {
  const store = getStore()
  if (!store.notificationSettings?.systemNotify) {
    logInfo('通知中心', `系统内通知已关闭，已拦截通知发送，设备: ${options.deviceName}`)
    return {
      blocked: true,
      reason: '系统内通知已关闭',
      records: []
    }
  }

  const users = UserDB.getAll().filter(user => user.status === 1)
  const senderId = options.senderId ?? null
  const specifiedIds = options.recipientIds?.length ? new Set(options.recipientIds) : null
  const recipients = users.filter(user => {
    if (specifiedIds) {
      return specifiedIds.has(user.id)
    }
    return options.includeSender ? true : user.id !== senderId
  })
  const finalRecipients = recipients.length > 0 ? recipients : users

  if (finalRecipients.length === 0) {
    return {
      blocked: false,
      reason: '',
      records: []
    }
  }

  const sendTime = getNowString()
  const records = finalRecipients.map(user => ({
    alertId: options.alertId ?? null,
    deviceId: options.deviceId ?? null,
    deviceName: options.deviceName,
    type: options.type || '系统通知',
    recipientId: user.id,
    recipientUsername: user.username,
    recipientName: user.realName || user.username,
    senderId,
    senderUsername: options.senderUsername || 'system',
    senderName: options.senderName || '系统',
    content: options.content,
    sendTime,
    status: '已送达'
  }))

  NotificationDB.insert(records as any)
  logInfo('通知中心', `已发送 ${records.length} 条系统通知，设备: ${options.deviceName}`)
  return {
    blocked: false,
    reason: '',
    records
  }
}
