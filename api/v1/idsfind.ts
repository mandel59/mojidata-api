import type { VercelRequest, VercelResponse } from '@vercel/node'

import { IDSFinder } from '@mandel59/idstool/lib/ids-finder'
import { writeArray, writeObject } from './_lib/json-encoder'

const idsFinder = new IDSFinder()

function castToStringArray(x: string | string[] | null): string[] {
  if (x == null) {
    return []
  }
  if (typeof x === 'string') {
    return [x]
  }
  return x
}

export default async (request: VercelRequest, response: VercelResponse) => {
  let { ids, whole } = request.query
  ids = castToStringArray(ids)
  whole = castToStringArray(whole)

  if (ids.length === 0) {
    response.status(400).send({ message: 'No ids param' })
    return
  }

  const results = idsFinder.find(...ids, ...whole.map((x) => `§${whole}§`))

  const write = async (chunk: string) => {
    if (response.write(chunk)) {
      return
    }
    await new Promise((resolve) => response.once('drain', resolve))
  }
  response.status(200)
  await writeObject(write, [
    ['query', { ids, whole }],
    ['results', async () => await writeArray(write, results)],
  ])
  response.end()
}
