var uuid = require('node-uuid')

exports.genMessageId = function genMessageId() {
  return 'urn:uuid:' + uuid.v4()
}
