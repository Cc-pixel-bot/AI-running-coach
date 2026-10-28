import { requestApi } from './requestApi.js'

export function getProfileApi(token) {
  return requestApi('/profile', { headers: { Authorization: `Bearer ${token}` } })
}

export function saveProfileApi(token, profile) {
  return requestApi('/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  })
}

export function confirmProfileApi(token) {
  return requestApi('/profile/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
