import { AxiosError, AxiosHeaders } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const user = {
  userId: 'user-1',
  fullName: 'Test User',
  email: 'test@example.com',
  phone: '+9779800000000',
  role: 'USER',
  status: 'ACTIVE',
}
const login = {
  accessToken: 'first-token',
  user,
  expiresIn: 900,
  expiresAt: '2026-10-01',
  tokenType: 'Bearer',
}
function success(config: InternalAxiosRequestConfig, data: unknown) {
  return {
    config,
    data: { success: true, data },
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
  }
}
function reject(config: InternalAxiosRequestConfig, status = 401) {
  return new AxiosError('API error', 'ERR_BAD_RESPONSE', config, undefined, {
    config,
    data: {
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
      details: { field: 'email' },
    },
    status,
    statusText: 'Error',
    headers: new AxiosHeaders(),
  })
}
beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})
async function setup() {
  const { api, request, ApiError } = await import('./api')
  const { auth } = await import('@/features/auth/session')
  const { queryClient } = await import('./query-client')
  return { api, request, ApiError, auth, queryClient }
}
describe('shared API and sessions', () => {
  it('rejects requests to unconfigured API origins before transport', async () => {
    const { api, request } = await setup()
    const adapter = vi.fn()
    api.defaults.adapter = adapter
    await expect(
      request('https://untrusted.example/wallet')
    ).rejects.toMatchObject({ code: 'INVALID_API_ORIGIN' })
    await expect(
      request('/wallet', { baseURL: 'https://untrusted.example' })
    ).rejects.toMatchObject({ code: 'INVALID_API_ORIGIN' })
    expect(adapter).not.toHaveBeenCalled()
  })
  it('reports invalid envelopes instead of treating HTML as API data', async () => {
    const { api, request } = await setup()
    api.defaults.adapter = (config) =>
      Promise.resolve({
        ...success(config, null),
        data: '<html>Proxy error</html>',
      })
    await expect(request('/wallet')).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
    })
  })

  it('preserves real BigDecimal JSON precision through the shared transport', async () => {
    const { api, request } = await setup()
    api.defaults.adapter = (config) =>
      Promise.resolve({
        ...success(config, null),
        data: '{"success":true,"data":{"balance":99999999999999999.99,"amount":0.10,"page":0}}',
      })
    expect(await request('/wallet')).toEqual({
      balance: '99999999999999999.99',
      amount: '0.10',
      page: 0,
    })
  })
  it('bounds retries when the renewed token is also rejected', async () => {
    const { api, auth, request } = await setup()
    let refreshes = 0
    let reads = 0
    api.defaults.adapter = (config) => {
      if (config.url === '/auth/login')
        return Promise.resolve(success(config, login))
      if (config.url === '/auth/refresh') {
        refreshes++
        return Promise.resolve(
          success(config, { ...login, accessToken: 'renewed' })
        )
      }
      reads++
      return Promise.reject(reject(config))
    }
    await auth.login({ email: user.email, password: 'password123' })
    await expect(request('/wallet')).rejects.toMatchObject({ status: 401 })
    expect(refreshes).toBe(1)
    expect(reads).toBe(2)
    expect(auth.getState().status).toBe('anonymous')
  })

  it('uses the default and configured API base URL', async () => {
    expect((await setup()).api.defaults.baseURL).toBe('/api/v1')
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/v1')
    expect((await setup()).api.defaults.baseURL).toBe(
      'https://api.example.com/api/v1'
    )
  })
  it('configures CSRF/cookies without bearer on auth, and bearer on private reads', async () => {
    const { api, auth, request } = await setup()
    const seen: Array<InternalAxiosRequestConfig> = []
    api.defaults.adapter = (config) => {
      seen.push(config)
      return Promise.resolve(
        success(config, config.url === '/auth/login' ? login : {})
      )
    }
    await auth.login({ email: user.email, password: 'password123' })
    await request('/wallet')
    await auth.register({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      password: 'password123',
    })
    await auth.logout()
    expect(seen[1].headers.get('Authorization')).toBe('Bearer first-token')
    for (const config of [seen[0], seen[2], seen[3]]) {
      expect(config.withCredentials).toBe(true)
      expect(config.headers.get('X-PayFlow-CSRF')).toBe('1')
      expect(config.headers.has('Authorization')).toBe(false)
    }
  })
  it('shares startup restoration and clears private caches on confirmed logout', async () => {
    const { api, auth, queryClient } = await setup()
    const adapter = vi.fn((config) => Promise.resolve(success(config, login)))
    api.defaults.adapter = adapter
    await Promise.all([auth.restore(), auth.restore(), auth.restore()])
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(auth.getState().user?.userId).toBe(user.userId)
    queryClient.setQueryData(['private', user.userId, 'wallet'], {
      balance: 100,
    })
    await auth.logout()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(auth.getState()).toMatchObject({
      status: 'anonymous',
      logoutUnconfirmed: false,
    })
  })
  it('performs one concurrent refresh and at most one retry per private read', async () => {
    const { api, auth, request } = await setup()
    let refreshes = 0
    let reads = 0
    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/login') return success(config, login)
      if (config.url === '/auth/refresh') {
        refreshes++
        await new Promise((resolve) => setTimeout(resolve, 10))
        return success(config, { ...login, accessToken: 'renewed-token' })
      }
      reads++
      if (config.headers.get('Authorization') === 'Bearer first-token')
        throw reject(config)
      return success(config, { balance: 0 })
    }
    await auth.login({ email: user.email, password: 'password123' })
    await Promise.all([request('/wallet'), request('/auth/me')])
    expect(refreshes).toBe(1)
    expect(reads).toBe(4)
  })
  it('ends a rejected session without refresh loops', async () => {
    const { api, auth, request } = await setup()
    let refreshes = 0
    api.defaults.adapter = (config) => {
      if (config.url === '/auth/login')
        return Promise.resolve(success(config, login))
      if (config.url === '/auth/refresh') refreshes++
      return Promise.reject(reject(config))
    }
    await auth.login({ email: user.email, password: 'password123' })
    await expect(request('/wallet')).rejects.toMatchObject({ status: 401 })
    await expect(request('/wallet')).rejects.toMatchObject({ status: 401 })
    expect(refreshes).toBe(1)
    expect(auth.getState().status).toBe('anonymous')
  })
  it.each([403, 500, undefined])(
    'does not refresh on %s or replay failed mutations',
    async (status) => {
      const { api, auth, request } = await setup()
      const adapter = vi.fn((config) =>
        config.url === '/auth/login'
          ? Promise.resolve(success(config, login))
          : Promise.reject(
              status
                ? reject(config, status)
                : new AxiosError('Network error', 'ERR_NETWORK', config)
            )
      )
      api.defaults.adapter = adapter
      await auth.login({ email: user.email, password: 'password123' })
      await expect(request('/wallet')).rejects.toMatchObject({ status })
      await expect(
        request('/wallet/deposit', {
          method: 'POST',
          data: { amount: '10.00' },
          headers: { 'Idempotency-Key': 'original-key' },
        })
      ).rejects.toMatchObject({ status })
      expect(adapter).toHaveBeenCalledTimes(3)
    }
  )
  it('discards late refresh responses after logout and shows an unconfirmed logout', async () => {
    const { api, auth, request, queryClient } = await setup()
    let release: (() => void) | undefined
    api.defaults.adapter = async (config) => {
      if (config.url === '/auth/login') return success(config, login)
      if (config.url === '/auth/refresh') {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return success(config, login)
      }
      if (config.url === '/auth/logout')
        throw new AxiosError('Network error', 'ERR_NETWORK', config)
      throw reject(config)
    }
    await auth.login({ email: user.email, password: 'password123' })
    const pending = request('/wallet').catch((error) => error)
    await vi.waitFor(() => expect(release).toBeDefined())
    await expect(auth.logout()).rejects.toMatchObject({ unknownOutcome: true })
    release!()
    expect(await pending).toMatchObject({ code: 'STALE_SESSION' })
    expect(auth.getState()).toMatchObject({
      status: 'anonymous',
      logoutUnconfirmed: true,
    })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
  it('preserves backend error status, code, message, and details', async () => {
    const { api, request } = await setup()
    api.defaults.adapter = (config) => Promise.reject(reject(config, 403))
    await expect(request('/wallet')).rejects.toMatchObject({
      status: 403,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required.',
      details: { field: 'email' },
    })
  })
})
