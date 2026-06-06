/**
 * 报表导出工具
 */
type ExportRow = Record<string, any>

interface ExportSheetColumn {
  key: string
  title: string
}

interface ExportSheetOptions {
  name: string
  data: ExportRow[]
  columns?: ExportSheetColumn[]
}

interface ExportExcelOptions {
  sheets?: ExportSheetOptions[]
  sheetName?: string
  columns?: ExportSheetColumn[]
}

function buildSheetRows(data: ExportRow[], columns?: ExportSheetColumn[]) {
  if (!columns || columns.length === 0) {
    return data
  }

  return data.map((row) => columns.reduce((mappedRow, column) => {
    mappedRow[column.title] = row[column.key] ?? ''
    return mappedRow
  }, {} as ExportRow))
}

/**
 * 导出为 JSON 文件
 */
export function exportJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `${filename}.json`)
}

/**
 * 导出为 CSV 文件
 */
export function exportCSV(data: any[], filename: string) {
  if (!data.length) return

  const headers = Object.keys(data[0])

  let csv = headers.join(',') + '\n'

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header]
      return typeof value === 'string' && value.includes(',')
        ? `"${value}"`
        : value
    })
    csv += values.join(',') + '\n'
  })

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

/**
 * 导出为真实 Excel 文件
 */
export async function exportExcel(data: any[], filename: string, options: string | ExportExcelOptions = 'Sheet1') {
  if (typeof window === 'undefined' || !data.length) return

  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const normalizedOptions: ExportExcelOptions = typeof options === 'string'
    ? { sheetName: options }
    : options

  const sheets = normalizedOptions.sheets && normalizedOptions.sheets.length > 0
    ? normalizedOptions.sheets
    : [{
        name: normalizedOptions.sheetName || 'Sheet1',
        data,
        columns: normalizedOptions.columns
      }]

  sheets.forEach((sheet) => {
    const sheetData = buildSheetRows(sheet.data, sheet.columns)
    const worksheet = XLSX.utils.json_to_sheet(sheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * 导出诊断报告 (HTML 格式)
 */
export function exportDiagnosisReport(diagnosis: any) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>故障诊断报告</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #409EFF; }
    .section { margin: 20px 0; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #409EFF; color: white; }
  </style>
</head>
<body>
  <h1>智能电网故障诊断报告</h1>

  <div class="section">
    <p><span class="label">设备ID:</span> <span class="value">${diagnosis.device_id}</span></p>
    <p><span class="label">诊断时间:</span> <span class="value">${diagnosis.timestamp}</span></p>
    <p><span class="label">故障类型:</span> <span class="value">${diagnosis.fault_type}</span></p>
    <p><span class="label">置信度:</span> <span class="value">${(diagnosis.confidence * 100).toFixed(2)}%</span></p>
    <p><span class="label">风险等级:</span> <span class="value">${diagnosis.risk_level}</span></p>
  </div>

  <h2>Node IDs 离散表征</h2>
  <table>
    <tr>
      ${diagnosis.node_ids.map((_: any, i: number) => `<th>特征${i + 1}</th>`).join('')}
    </tr>
    <tr>
      ${diagnosis.node_ids.map((val: number) => `<td>${val}</td>`).join('')}
    </tr>
  </table>

  <div class="section">
    <h2>诊断建议</h2>
    <p>根据 Node IDs 离散表征分析，建议采取相应的维护措施。</p>
  </div>
</body>
</html>
  `

  const blob = new Blob([html], { type: 'text/html' })
  downloadBlob(blob, `诊断报告_${diagnosis.device_id}_${Date.now()}.html`)
}

/**
 * 下载 Blob
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
