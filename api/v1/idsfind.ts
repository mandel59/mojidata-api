import type { VercelRequest, VercelResponse } from '@vercel/node'

import { IDSFinder } from '@mandel59/idstool/lib/ids-finder'
import { writeArray, writeObject } from './_lib/json-encoder'

const idsFinder = new IDSFinder()

const jsonContentType = 'application/json; charset=utf-8'

const headers = [
  { key: 'Content-Type', value: jsonContentType },
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
]

function castToStringArray(x: string | string[] | null): string[] {
  if (x == null) {
    return []
  }
  if (typeof x === 'string') {
    return [x]
  }
  return x
}

function* skipUntil<T>(
  condition: (x: T) => boolean,
  gen: Generator<T>,
): Generator<T> {
  let next = gen.next()
  while (!next.done && !condition(next.value)) {
    next = gen.next()
  }
  yield* gen
}

function* take<T>(n: number, gen: Generator<T>): Generator<T> {
  let next = gen.next()
  for (let i = 0; i < n; i++) {
    if (next.done) return
    yield next.value
    next = gen.next()
  }
}

export default async (request: VercelRequest, response: VercelResponse) => {
  let { ids, whole, limit, after } = request.query
  ids = castToStringArray(ids)
  whole = castToStringArray(whole)
  const limitNum = (limit && parseInt(String(limit), 10)) || undefined
  const afterStr = after ? String(after) : undefined

  if (ids.length === 0 && whole.length === 0) {
    response.status(400)
    headers.forEach(({ key, value }) => response.setHeader(key, value))
    response.send({ message: 'No parameters' })
    return
  }

  let results = idsFinder.find(...ids, ...whole.map((x) => `§${whole}§`))

  if (afterStr) {
    results = skipUntil((x) => x === afterStr, results)
  }
  if (Number.isSafeInteger(limitNum)) {
    results = take(limitNum!, results)
  }

  const write = async (chunk: string) => {
    if (response.write(chunk)) {
      return
    }
    await new Promise((resolve) => response.once('drain', resolve))
  }
  response.status(200)
  headers.forEach(({ key, value }) => response.setHeader(key, value))
  await writeObject(write, [
    ['query', { ids, whole, after: afterStr, limit: limitNum }],
    ['results', async () => await writeArray(write, results)],
  ])
  response.end()
}
