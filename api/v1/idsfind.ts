import type { VercelRequest, VercelResponse } from '@vercel/node'

import { IDSFinder } from '@mandel59/idstool/lib/ids-finder'
import { writeObject } from './_lib/json-encoder'

type Ref<T> = { current: T }

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

function* drop<T>(n: number, gen: Generator<T>): Generator<T> {
  for (let i = 0; i < n; i++) {
    const { done } = gen.next()
    if (done) {
      return
    }
  }
  yield* gen
}

function* take<T>(
  n: number,
  gen: Generator<T>,
  doneRef?: Ref<boolean | undefined>,
): Generator<T> {
  let next = gen.next()
  for (let i = 0; i < n; i++) {
    if (next.done) {
      if (doneRef) doneRef.current = true
      return
    }
    yield next.value
    next = gen.next()
  }
  if (doneRef) doneRef.current = next.done ?? false
}

export default async (request: VercelRequest, response: VercelResponse) => {
  const idsFinder = new IDSFinder({
    dbOptions: {
      readonly: true,
    },
  })
  let { ids, whole, limit, offset } = request.query
  ids = castToStringArray(ids)
  whole = castToStringArray(whole)
  const limitNum = (limit && parseInt(String(limit), 10)) || undefined
  const offsetNum = (offset && parseInt(String(offset), 10)) || undefined
  const doneRef: Ref<boolean | undefined> = { current: undefined }

  if (ids.length === 0 && whole.length === 0) {
    response.status(400)
    headers.forEach(({ key, value }) => response.setHeader(key, value))
    response.send({
      message: 'No parameters',
      error: { message: 'No parameters' },
    })
    return
  }

  let results = idsFinder.find(...ids, ...whole.map((x) => `§${whole}§`))

  const usingLimit = Number.isSafeInteger(limitNum) && limitNum! > 0
  const usingOffset = Number.isSafeInteger(offsetNum) && offsetNum! > 0

  if (usingOffset) {
    results = drop(offsetNum!, results)
  }

  if (usingLimit) {
    results = take(limitNum!, results, doneRef)
  }

  const resultValues = [...results]

  const write = async (chunk: string) => {
    if (response.write(chunk)) {
      return
    }
    await new Promise((resolve) => response.once('drain', resolve))
  }
  response.status(200)
  headers.forEach(({ key, value }) => response.setHeader(key, value))
  await writeObject(write, [
    ['query', { ids, whole, limit: limitNum, offset: offsetNum }],
    ['results', resultValues],
    usingLimit && ['done', doneRef.current],
  ])
  response.end()
}
