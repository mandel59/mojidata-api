import { VercelRequest, VercelResponse } from '@vercel/node'
import { writeObject } from './_lib/json-encoder'
import { getResponseWriter } from './_lib/get-response-writer'
import { getApiHeaders } from './_lib/getApiHeaders'
import { db } from './_lib/mojidata-db'
import { Ref, drop, take } from './_lib/iterator-utils'
import { castToStringArray } from './_lib/cast'

const queries: Partial<Record<string, string>> = {
  'UCS': `WITH x(x) AS (VALUES (parse_int(?, 16))) SELECT DISTINCT char(x) AS r FROM x WHERE char(x) regexp '^[\\p{L}\\p{N}\\p{S}]$'`,
  'mji.読み': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
      JOIN mji_reading USING (MJ文字図形名)
    WHERE mji.対応するUCS IS NOT NULL
      AND mji_reading.読み = ?`,
  'mji.読み.prefix': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
      JOIN mji_reading USING (MJ文字図形名)
    WHERE mji.対応するUCS IS NOT NULL
      AND mji_reading.読み glob (replace(?, '*', '') || '*')`,
  'mji.総画数': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.総画数 = cast(? as integer)`,
  'mji.総画数.lt': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.総画数 < cast(? as integer)`,
  'mji.総画数.le': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.総画数 <= cast(? as integer)`,
  'mji.総画数.gt': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.総画数 > cast(? as integer)`,
  'mji.総画数.ge': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.総画数 >= cast(? as integer)`,
      'mji.MJ文字図形名': `
    SELECT DISTINCT mji.対応するUCS AS r
    FROM mji
    WHERE mji.対応するUCS IS NOT NULL
      AND mji.MJ文字図形名 = ?`,
}

function getQuery(p: string) {
  const query = queries[p]
  if (query === undefined) {
    throw new Error(`Unknown query key: ${p}`)
  }
  return query
}

function* search(ps: string[], qs: string[]) {
  const query = ps.map((p) => getQuery(p)).join(' INTERSECT ')
  const stmt = db.prepare<any, ['r'], { r: string }>(query).pluck()
  for (const value of stmt.iterate(qs)) {
    yield value
  }
}

export default async (request: VercelRequest, response: VercelResponse) => {
  let { p, q, limit, offset } = request.query
  const ps = castToStringArray(p)
  const qs = castToStringArray(q)
  const headers = getApiHeaders()
  if (ps.length === 0) {
    response.status(400)
    headers.forEach(({ key, value }) => response.setHeader(key, value))
    response.send(JSON.stringify({ error: { message: 'p is required' } }))
    return
  }
  if (qs.length !== ps.length) {
    response.status(400)
    headers.forEach(({ key, value }) => response.setHeader(key, value))
    response.send(
      JSON.stringify({
        error: { message: 'q.length must be equal to p.length' },
      }),
    )
    return
  }
  const limitNum = (limit && parseInt(String(limit), 10)) || undefined
  const offsetNum = (offset && parseInt(String(offset), 10)) || undefined
  const usingLimit = Number.isSafeInteger(limitNum) && limitNum! > 0
  const usingOffset = Number.isSafeInteger(offsetNum) && offsetNum! > 0

  const doneRef: Ref<boolean | undefined> = { current: undefined }
  let results = search(ps, qs)

  if (usingOffset) {
    results = drop(offsetNum!, results)
  }

  if (usingLimit) {
    results = take(limitNum!, results, doneRef)
  }

  const r = [...results]
  const write = getResponseWriter(response)
  response.status(200)
  headers.forEach(({ key, value }) => response.setHeader(key, value))
  await writeObject(write, [
    ['query', { p: ps, q: qs, limit: limitNum, offset: offsetNum }],
    ['results', r],
    usingLimit && ['done', doneRef.current],
    !usingLimit && !usingOffset && ['total', r.length],
  ])
  response.end()
}
