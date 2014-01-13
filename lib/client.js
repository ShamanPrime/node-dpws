var WSDiscovery = require('ws-discovery')
  , EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , util = require('./util')
  , xmlbuilder = require('xmlbuilder')
  , request = require('request')
  , et = require('elementtree')

function makeInvocationBody(opts) {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
  '<s12:Envelope xmlns:dpws="http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01" xmlns:s12="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">' +
  '<s12:Header>' +
      '<wsa:Action>' + opts.action + '</wsa:Action>' +
      '<wsa:MessageID>' + opts.messageId + '</wsa:MessageID>' +
      '<wsa:To>' + opts.to + '</wsa:To>' +
  '</s12:Header>' +
  '<s12:Body/>' +
  '</s12:Envelope>'
}

function Client(opts) {
  this.discovery = new WSDiscovery()
}

/*

*/

inherits(Client, EventEmitter)

Client.prototype.close = function () {
  this.discovery.once('close', this.emit.bind(this, 'close'))
  this.discovery.close()
}

Client.prototype.invoke = function (opts, cb) {
  opts.messageId = opts.messageId || util.genMessageId()

  var uri = opts.to || opts.uri

  var xml = makeInvocationBody(opts)

  request({
    uri: uri,
    method: 'POST',
    body: xml,
    timeout: 5000,
  }, function (err, resp, body) {
    if (err) {
      return cb(err)
    }

    if (resp.statusCode >= 400) {
      throw new Error(body || "request error")
    }

    var body = et.parse(body).find('s12:Body')
      , reply = []
    if (body) {
      for (var i = 0; i < body._children.length; i++) {
        var child = body._children[i]

        reply.push(child.text)
      }
    }

    cb(null, reply)
  })
}

module.exports = Client