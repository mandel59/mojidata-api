import { db } from './mojidata-db'

const queries: Partial<Record<string, string>> = {
  UCS: `WITH x(x) AS (VALUES (parse_int(?, 16))) SELECT DISTINCT char(x) AS r FROM x WHERE char(x) regexp '^[\\p{L}\\p{N}\\p{S}]$'`,
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

export function getQuery(p: string) {
  const query = queries[p]
  if (query === undefined) {
    throw new Error(`Unknown query key: ${p}`)
  }
  return query.trim()
}

export function* filterChars(chars: string[], ps: string[], qs: string[]) {
  const query = `WITH c(char) AS (select value from json_each(?))
    SELECT c.char AS r
    FROM c
    WHERE ${ps.map((p) => `c.char IN (${getQuery(p)})`).join(' AND ')}`
  const stmt = db.prepare<any, ['r'], { r: string }>(query).pluck()
  yield* stmt.iterate([JSON.stringify(chars), ...qs])
}

export function* search(ps: string[], qs: string[]) {
  const query = ps.map((p) => getQuery(p)).join(' INTERSECT ')
  const stmt = db.prepare<any, ['r'], { r: string }>(query).pluck()
  for (const value of stmt.iterate(qs)) {
    yield value
  }
}
