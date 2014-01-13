var Server = require('./server')
  , Client = require('./client')


exports.createServer = function (opts) {
  return new Server(opts)
}

exports.createClient = function (opts) {
	return new Client(opts)
}

exports.Server = Server
exports.Service = require('./service')
exports.Operation = require('./operation')