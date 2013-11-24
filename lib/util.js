var uuid = require('node-uuid')

exports.genMessageId = function genMessageId() {
  return 'urn:uuid:' + uuid.v4()
}

exports.msTo8601Duration = function msTo8601Duration(ms) {
  return 'PT' + Math.floor(ms / 1000) + 'S'
}
