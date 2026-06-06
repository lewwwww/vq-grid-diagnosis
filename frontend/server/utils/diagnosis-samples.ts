import { existsSync, readFileSync } from 'fs'
import { basename, resolve } from 'path'

export interface DiagnosisSample {
  rowIndex: number
  classId?: number
  Ia: number
  Ib: number
  Ic: number
  Va: number
  Vb: number
  Vc: number
}

const LABEL_MAP: Record<string, number> = {
  '0000': 0,
  '1001': 1,
  '0110': 2,
  '0111': 3,
  '1011': 4,
  '1111': 5,
}

const CLASS_IDS = [0, 1, 2, 3, 4, 5]

function resolveClassDataPath() {
  const candidates = [
    resolve(process.cwd(), '../data_new/kaggle/classData.csv'),
    resolve(process.cwd(), 'data_new/kaggle/classData.csv'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error('未找到 classData.csv 数据集文件')
}

function parseAllDiagnosisSamples() {
  const csvPath = resolveClassDataPath()
  const content = readFileSync(csvPath, 'utf-8')
  const lines = content.trim().split(/\r?\n/)
  const header = lines[0]?.split(',') ?? []
  const samples: DiagnosisSample[] = []

  for (let index = 1; index < lines.length; index++) {
    const cols = lines[index].trim().split(',')
    if (cols.length < 10) {
      continue
    }

    const classKey = `${cols[0]}${cols[1]}${cols[2]}${cols[3]}`
    const classId = LABEL_MAP[classKey]
    if (classId === undefined) {
      continue
    }

    samples.push({
      rowIndex: index,
      classId,
      Ia: Number.parseFloat(cols[4]),
      Ib: Number.parseFloat(cols[5]),
      Ic: Number.parseFloat(cols[6]),
      Va: Number.parseFloat(cols[7]),
      Vb: Number.parseFloat(cols[8]),
      Vc: Number.parseFloat(cols[9]),
    })
  }

  return {
    csvPath,
    fileName: basename(csvPath),
    header,
    totalRows: Math.max(lines.length - 1, 0),
    samples
  }
}

function selectEvenlySpacedSamples(samples: DiagnosisSample[], maxCount: number) {
  if (samples.length <= maxCount) {
    return samples
  }

  if (maxCount <= 1) {
    return [samples[Math.floor(samples.length / 2)]]
  }

  const lastIndex = samples.length - 1
  return Array.from({ length: maxCount }, (_, index) => {
    const sampleIndex = Math.round((index * lastIndex) / (maxCount - 1))
    return samples[sampleIndex]
  })
}

export function loadDiagnosisSamples(maxPerClass = 10) {
  const { samples: allSamples } = parseAllDiagnosisSamples()
  const buckets = new Map<number, DiagnosisSample[]>()

  for (const classId of CLASS_IDS) {
    buckets.set(classId, [])
  }

  for (const sample of allSamples) {
    if (sample.classId !== undefined) {
      buckets.get(sample.classId)?.push(sample)
    }
  }

  const selectedBuckets = CLASS_IDS.map((classId) => selectEvenlySpacedSamples(buckets.get(classId) ?? [], maxPerClass))
  const maxBucketLength = Math.max(...selectedBuckets.map(bucket => bucket.length), 0)
  const samples: DiagnosisSample[] = []

  for (let index = 0; index < maxBucketLength; index++) {
    for (const bucket of selectedBuckets) {
      const sample = bucket[index]
      if (sample) {
        samples.push(sample)
      }
    }
  }

  return samples
}
export function loadAllDiagnosisSamples() {
  return parseAllDiagnosisSamples().samples
}

export function loadDiagnosisSamplesByRange(startRow: number, rowCount: number) {
  const allSamples = loadAllDiagnosisSamples()
  const safeStartRow = Math.max(1, Math.floor(startRow || 1))
  const safeRowCount = Math.max(1, Math.floor(rowCount || 1))
  const endRow = safeStartRow + safeRowCount - 1

  return allSamples.filter(sample => sample.rowIndex >= safeStartRow && sample.rowIndex <= endRow)
}

export function getDiagnosisDatasetPage(page = 1, size = 10) {
  const { csvPath, fileName, header, totalRows, samples } = parseAllDiagnosisSamples()
  const safePage = Math.max(1, Math.floor(page || 1))
  const safeSize = Math.max(1, Math.floor(size || 10))
  const start = (safePage - 1) * safeSize
  const records = samples.slice(start, start + safeSize)

  return {
    fileName,
    filePath: csvPath,
    header,
    totalRows,
    availableRows: samples.length,
    recommendedSampleCount: loadDiagnosisSamples(10).length,
    page: safePage,
    size: safeSize,
    records
  }
}
