import isRegExp from 'lodash.isregexp'
import isFunction from 'lodash.isfunction'

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export default function getDetector({ pattern }) {
  let detector

  if (pattern) {
    if (isFunction(pattern)) {
      detector = pattern
    } else if (isRegExp(pattern)) {
      detector = text => pattern.test(text)
    } else {
      detector = text => pattern === text
    }
  } else {
    detector = text => /[\u4e00-\u9fa5]/.test(text)
  }


  const cache = {}
  return (text) => {
    if (!hasOwn(cache, text)) {
      cache[text] = !!detector(text)
    }
    return cache[text]
  }
}
