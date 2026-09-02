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
