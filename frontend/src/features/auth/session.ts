import { useSyncExternalStore } from 'react'

import { ApiError, connectSession, request } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

import type {
  LoginInput,
  LoginResponse,
  RegisterInput,
  RegisterResponse,
  User,
} from './contracts'

type State = {
  status: 'unknown' | 'authenticated' | 'anonymous'
  user: User | null
  logoutUnconfirmed: boolean
}

let state: State = { status: 'unknown', user: null, logoutUnconfirmed: false }
let token: string | null = null
let generation = 0
let refreshPromise: Promise<void> | undefined
let startupPromise: Promise<void> | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function clear(logoutUnconfirmed = false) {
  generation++
  token = null
  state = { status: 'anonymous', user: null, logoutUnconfirmed }

  void queryClient.cancelQueries()
  queryClient.clear()
  for (const key of Object.keys(globalThis.sessionStorage ?? {})) {
    if (key.startsWith('payflow-intent:')) sessionStorage.removeItem(key)
  }

  emit()
}

function accept(response: LoginResponse, expected: number) {
  if (expected !== generation)
    throw new ApiError('This session has changed.', 401, 'STALE_SESSION')

  token = response.accessToken
  state = {
    status: 'authenticated',
    user: response.user,
    logoutUnconfirmed: false,
  }

  queryClient.setQueryData(
    ['private', response.user.userId, 'me'],
    response.user
  )

  emit()
}

function refresh() {
  if (!refreshPromise) {
    const expected = generation

    refreshPromise = request<LoginResponse>('/auth/refresh', { method: 'POST' })
      .then((response) => accept(response, expected))
      .catch((error) => {
        if (
          expected === generation &&
          error instanceof ApiError &&
          error.status === 401
        )
          clear()
        throw error
      })
      .finally(() => {
        refreshPromise = undefined
      })
  }

  return refreshPromise
}

export const auth = {
  async revalidateProfile() {
    const expected = generation
    const user = await request<User>('/auth/me')
    if (expected !== generation || state.user?.userId !== user.userId)
      throw new ApiError('This session has changed.', 401, 'STALE_SESSION')
    state = { ...state, user }
    queryClient.setQueryData(['private', user.userId, 'me'], user)
    emit()
  },
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
    }
  },
  async restore() {
    if (state.status !== 'unknown') return

    if (!startupPromise) {
      startupPromise = refresh()
        .catch((error) => {
          if (!(error instanceof ApiError && error.status === 401)) throw error
        })
        .finally(() => {
          startupPromise = undefined
        })
    }

    return startupPromise
  },
  async login(input: LoginInput) {
    clear()

    const expected = generation
    const response = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      data: input,
    })

    accept(response, expected)
  },
  register: (input: RegisterInput) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      data: input,
    }),
  async logout() {
    clear(true)

    const expected = generation

    await request<null>('/auth/logout', { method: 'POST' })
    if (expected === generation) {
      state = { ...state, logoutUnconfirmed: false }
      emit()
    }
  },
}

connectSession({
  token: () => token,
  generation: () => generation,
  refresh,
  invalidate: () => clear(),
})

export function useSession() {
  return useSyncExternalStore(auth.subscribe, auth.getState)
}
