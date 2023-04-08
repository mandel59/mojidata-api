export type IterableOrAsyncIterable<T> = Iterable<T> | AsyncIterable<T>
export type MaybePromise<T> = T | Promise<T>

export type Writer = (chunk: string) => MaybePromise<void>

export type Serializable =
  | string
  | number
  | boolean
  | null
  | object
  | undefined
  | (() => MaybePromise<boolean>)

export async function writeValue(write: Writer, value: Serializable) {
  if (value === undefined) {
    return false
  }
  if (typeof value === 'function') {
    return await value()
  } else {
    await write(JSON.stringify(value))
    return true
  }
}

export async function writeArray<T extends Serializable>(
  write: Writer,
  values: IterableOrAsyncIterable<T>,
) {
  await write('[')
  let previous = false
  for await (const value of values) {
    if (previous) {
      await write(',')
    }
    previous = (await writeValue(write, value)) || false
  }
  await write(']')
  return true
}

export async function writeObject(
  write: Writer,
  entries: IterableOrAsyncIterable<[key: string, value: Serializable]>,
) {
  await write('{')
  let previous = false
  for await (const [key, value] of entries) {
    if (previous) {
      await write(',')
    }
    await write(JSON.stringify(key))
    await write(':')
    previous = (await writeValue(write, value)) || false
  }
  await write('}')
  return true
}
