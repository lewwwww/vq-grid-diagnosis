import { spawn } from 'child_process'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  return new Promise((resolvePromise, reject) => {
    const rootDir = resolve(process.cwd(), '..')
    const scriptPath = resolve(rootDir, 'algorithm', 'generate_sample_data.py')
    
    const child = spawn('python', [scriptPath], { cwd: rootDir, shell: true })
    
    let output = ''
    let errorOutput = ''
    
    child.stdout?.on('data', (data) => {
      output += data.toString()
    })
    
    child.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({
          code: 200,
          message: '示例数据生成成功',
          data: { output }
        })
      } else {
        reject({
          code: 500,
          message: '生成失败',
          data: { error: errorOutput }
        })
      }
    })
    
    child.on('error', (error) => {
      reject({
        code: 500,
        message: error.message,
        data: null
      })
    })
  })
})

