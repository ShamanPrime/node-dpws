var Type = require('./type')

function Operation(id, opts) {
  this.id = id
  this.types = opts.types
  this.input = opts.input
  this.output = opts.output
}

module.exports = Operation
