var Server = require('./server')

exports.createServer = function (opts) {
  return new Server(opts)
}

exports.Server = Server
exports.Service = require('./service')