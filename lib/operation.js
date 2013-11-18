var Type = require('./type')

function Operation(id, opts, handler) {
  this.id = id
  this.types = opts.types
  this.input = opts.input
  this.output = opts.output
  this.handler = handler
}

module.exports = Operation
