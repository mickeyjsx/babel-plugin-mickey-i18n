export default function (opts) {
  const {
    dest = './i18n_messages',
    filename = 'i18n.json',
    debug = false,
  } = opts

  return {
    dest,
    filename,
    debug,
  }
}
