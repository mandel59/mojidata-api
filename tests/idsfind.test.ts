import { describe, expect, test } from 'bun:test'
import { fetchJson } from './test-utils'

describe('GET /api/v1/idsfind', () => {
  test('finds characters by IDS fragments', async () => {
    const { response, json } = await fetchJson('/api/v1/idsfind', {
      ids: ['⿰亻言'],
      limit: 5,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type') ?? '').toContain(
      'application/json',
    )
    expect(response.headers.get('access-control-allow-origin')).toBe('*')

    expect(json.query.ids).toEqual(['⿰亻言'])
    expect(Array.isArray(json.results)).toBe(true)
    expect(json.results.length).toBeLessThanOrEqual(5)
  })

  test('finds characters by whole-character patterns', async () => {
    const { response, json } = await fetchJson('/api/v1/idsfind', {
      whole: ['⿰亻言'],
      limit: 5,
    })

    expect(response.status).toBe(200)
    expect(json.query.whole).toEqual(['⿰亻言'])
    expect(Array.isArray(json.results)).toBe(true)
    expect(json.results.length).toBeLessThanOrEqual(5)
  })

  test('supports property-search mode (p/q) without ids/whole', async () => {
    const { response, json } = await fetchJson('/api/v1/idsfind', {
      p: ['totalStrokes'],
      q: ['13'],
      limit: 5,
    })

    expect(response.status).toBe(200)
    expect(json.query.p).toEqual(['totalStrokes'])
    expect(json.query.q).toEqual(['13'])
    expect(Array.isArray(json.results)).toBe(true)
    expect(json.results.length).toBeLessThanOrEqual(5)
  })
})
