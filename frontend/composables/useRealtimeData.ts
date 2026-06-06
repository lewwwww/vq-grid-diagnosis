/**
 * WebSocket 实时数据连接
 */
import { ref, onUnmounted } from 'vue'

export function useRealtimeData() {
  const connected = ref(false)
  const data = ref<any>(null)
  const error = ref<string | null>(null)
  
  let ws: WebSocket | null = null
  
  const connect = () => {
    try {
      // 连接 WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/ws/realtime`
      
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        console.log('[WebSocket] Connected')
        connected.value = true
        error.value = null
        
        // 请求开始推送数据
        ws?.send(JSON.stringify({ text: 'start' }))
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'realtime_data') {
            data.value = message.data
          }
        } catch (e) {
          console.error('[WebSocket] Parse error:', e)
        }
      }
      
      ws.onerror = (e) => {
        console.error('[WebSocket] Error:', e)
        error.value = '连接错误'
        connected.value = false
      }
      
      ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        connected.value = false
      }
    } catch (e: any) {
      error.value = e.message
      connected.value = false
    }
  }
  
  const disconnect = () => {
    if (ws) {
      ws.close()
      ws = null
      connected.value = false
    }
  }
  
  // 组件卸载时自动断开连接
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    connected,
    data,
    error,
    connect,
    disconnect
  }
}

