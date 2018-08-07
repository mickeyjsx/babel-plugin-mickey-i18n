/* eslint-disable no-bitwise */

function hashcode(str) {
  let hash = 0

  if (!str || str.length === 0) {
    return hash
  }

  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash &= hash
  }

  return hash
}

export default function (text) {
  return hashcode(text)
}
