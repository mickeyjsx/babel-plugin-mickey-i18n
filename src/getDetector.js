import isRegExp from 'lodash.isregexp'

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export default function getDetector({ exclude }) {
  const detector = text => /[\u4e00-\u9fa5]/.test(text)

  const cache = {}
  return (text, filename) => {
    if (exclude && filename) {
      if (isRegExp(exclude) && exclude.test(filename)) {
        return false
      }
      if (Array.isArray(exclude) && exclude.some(regExp => regExp.test(filename))) {
        return false
      }
    }

    if (text === '__proto__') { // __proto__ property could not be set, it's value of 'cache' is always {}
      return false
    }
    if (!hasOwn(cache, text)) {
      cache[text] = !!detector(text)
    }
    return cache[text]
  }
}
