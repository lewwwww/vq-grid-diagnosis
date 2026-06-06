/**
 * WebSocket 实时数据推送服务
 */
import type { H3Event } from 'h3'

// 存储所有连接的客户端
const clients = new Set<any>()

// 模拟设备实时数据
function generateRealtimeData() {
  return {
    timestamp: new Date().toISOString(),
    devices: Array.from({ length: 10 }, (_, i) => ({
      id: `device_${i + 1}`,
      voltage: (220 + Math.random() * 10).toFixed(2),
      current: (50 + Math.random() * 20).toFixed(2),
      power: (1000 + Math.random() * 500).toFixed(2),
      temperature: (40 + Math.random() * 10).toFixed(2),
      status: Math.random() > 0.9 ? 'fault' : 'online'
    }))
  }
}

export default defineWebSocketHandler({
  open(peer) {
    console.log('[WebSocket] Client connected:', peer.id)
    clients.add(peer)
    
    // 发送欢迎消息
    peer.send({
      type: 'connected',
      message: '实时数据推送已连接'
    })
  },

  message(peer, message) {
    console.log('[WebSocket] Received:', message)
    
    // 处理客户端请求
    if (message.text === 'start') {
      // 开始推送实时数据
      const interval = setInterval(() => {
        if (clients.has(peer)) {
          peer.send({
            type: 'realtime_data',
            data: generateRealtimeData()
          })
        } else {
          clearInterval(interval)
        }
      }, 3000) // 每3秒推送一次
      
      peer.send({
        type: 'started',
        message: '实时数据推送已启动'
      })
    }
  },

  close(peer) {
    console.log('[WebSocket] Client disconnected:', peer.id)
    clients.delete(peer)
  },

  error(peer, error) {
    console.error('[WebSocket] Error:', error)
    clients.delete(peer)
  }
})

