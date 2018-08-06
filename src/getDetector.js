import isRegExp from 'lodash.isregexp'
import isFunction from 'lodash.isfunction'

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export default function getDetector({ pattern }) {
  let detector

  if (pattern) {
    if (isFunction(pattern)) {
      detector = pattern
    }

    if (isRegExp(pattern)) {
      detector = text => pattern.test(text)
    }

    detector = text => pattern === text
  }

  detector = text => /[\u4e00-\u9fa5]/.test(text)

  const cache = {}
  return (text) => {
    if (!hasOwn(cache, text)) {
      cache[text] = !!detector(text)
    }
    return cache[text]
  }
}
