import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { isLosslessNumber, parse } from 'lossless-json'

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
  get unknownOutcome() {
    return this.status === undefined
  }
}

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const body = error.response?.data
    return new ApiError(
      body?.message ??
        (error.response
          ? 'The request could not be completed.'
          : 'Unable to reach PayFlow. Check your connection and try again.'),
      error.response?.status,
      body?.code ?? error.code,
      body?.errors ?? body?.details
    )
  }
  return new ApiError('Something went wrong. Please try again.')
}

type SessionTransport = {
  token: () => string | null
  generation: () => number
  refresh: () => Promise<unknown>
  invalidate: () => void
}
let session: SessionTransport | undefined
export function connectSession(transport: SessionTransport) {
  session = transport
}

type RequestConfig = InternalAxiosRequestConfig & {
  retried?: boolean
  generation?: number
}
const publicAuth = /^\/auth\/(register|login|refresh|logout)$/
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15_000,
  // Spring serializes BigDecimal as JSON numbers. Preserve monetary lexemes.
  transformResponse: [
    (data: unknown) => {
      if (typeof data !== 'string' || !data.length) return data
      try {
        return parse(data, (key, value) =>
          isLosslessNumber(value)
            ? key === 'balance' || key === 'amount'
              ? value.value
              : Number(value.value)
            : value
        )
      } catch {
        // Preserve the HTTP status even when a proxy returns non-JSON errors.
        return data
      }
    },
  ],
})
api.interceptors.request.use((config: RequestConfig) => {
  if (
    !config.url?.startsWith('/') ||
    config.url.startsWith('//') ||
    config.url.includes('\\') ||
    config.baseURL !== api.defaults.baseURL
  ) {
    throw new ApiError(
      'Requests must use the configured PayFlow API.',
      undefined,
      'INVALID_API_ORIGIN'
    )
  }
  config.generation ??= session?.generation()
  config.headers.delete('Authorization')
  if (publicAuth.test(config.url ?? '')) {
    config.withCredentials = true
    config.headers.set('X-PayFlow-CSRF', '1')
  } else if (session?.token()) {
    config.headers.set('Authorization', `Bearer ${session.token()}`)
  }
  return config
})
api.interceptors.response.use(
  (response) => {
    const config = response.config as RequestConfig
    if (
      !publicAuth.test(config.url ?? '') &&
      config.generation !== session?.generation()
    ) {
      throw new ApiError('This session has changed.', 401, 'STALE_SESSION')
    }
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw normalizeError(error)
    const config = error.config as RequestConfig | undefined
    if (
      config &&
      !publicAuth.test(config.url ?? '') &&
      error.response?.status === 401 &&
      config.generation === session?.generation() &&
      session?.token()
    ) {
      if (!config.retried && config.method === 'get') {
        config.retried = true
        // A delayed 401 may belong to a token another request already renewed.
        if (
          config.headers.get('Authorization') === `Bearer ${session.token()}`
        ) {
          await session.refresh()
        }
        if (config.generation !== session.generation())
          throw new ApiError('This session has changed.', 401, 'STALE_SESSION')
        return api.request(config)
      }
      session.invalidate()
    }
    throw normalizeError(error)
  }
)

export async function request<T>(
  path: string,
  config: Parameters<typeof api.request>[0] = {}
): Promise<T> {
  const response = await api.request<
    { success: boolean; data: T } | string | null
  >({
    ...config,
    url: path,
  })
  if (
    typeof response.data !== 'object' ||
    response.data === null ||
    response.data.success !== true ||
    !Object.hasOwn(response.data, 'data')
  ) {
    throw new ApiError(
      'PayFlow returned an unexpected response. Please try again.',
      response.status,
      'INVALID_RESPONSE'
    )
  }
  return response.data.data
}
