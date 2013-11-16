var restify = require('restify')
  , WSDiscovery = require('ws-discovery')
  , et = require('elementtree')
  , xmlbuilder = require('xmlbuilder')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , util = require('util')
  , Service = require('./service')

function Server(opts) {
  var self = this

  this.opts = opts || {}

  if (!opts.device) {
    throw new Error('a device must be provided')
  }

  if (!opts.host) {
    throw new Error('host to advertise must be provided')
  }

  this.services = {}

  this.device = this.opts.device
  this.httpServer = restify.createServer({
    formatters: {
      'application/soap+xml': function (req, res, body) {
        return body
      }
    }
  })

  this.httpServer.use(restify.bodyParser())

  this.discovery = WSDiscovery({
    device: this.device
  })

  this.httpServer.post('/', function (req, res) {
    res.setHeader('content-type', 'application/soap+xml')
    res.send(self._makeMetadataBody())
  })
}

util.inherits(Server, EventEmitter)

Server.prototype.listen = function (port, cb) {
  var self = this

  if (typeof port === 'function') {
    cb = port
  }

  async.series([
    this.httpServer.listen.bind(this.httpServer, port),
    function setXAddrs(cb) {
      var address = self.httpServer.address()

      self.port = address.port

      self.device.xaddrs = 'http://' + self.opts.host + ':' + self.port + '/'

      for (var serviceId in self.services) {
        self.services[serviceId].url = self._urlForService(serviceId)
      }

      setImmediate(cb)
    },
    this.discovery.bind.bind(this.discovery)
  ], function (err) {
    if (err) {
      if (cb) {
        return cb(err)
      }
      else {
        return self.emit('error', err)
      }
    }

    self.emit('listening')
    if (cb) {
      cb()
    }
  })
}

Server.prototype.bye = function (cb) {
  this.discovery.bye(cb)
}

Server.prototype._hostnameAndPort = function () {
  return this.opts.host + ':' + this.port
}

Server.prototype._makeMetadataBody = function () {
  var device = this.device

  var xml = xmlbuilder
    .create('s12:Envelope', { encoding: 'UTF-8', version: '1.0' })
      .att('xmlns:dpws', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01')
      .att('xmlns:s12', 'http://www.w3.org/2003/05/soap-envelope')
      .att('xmlns:wsa', 'http://www.w3.org/2005/08/addressing')
      .att('xmlns:wsx', 'http://schemas.xmlsoap.org/ws/2004/09/mex')
    .e('s12:Header')
      .e('wsa:Action', 'http://schemas.xmlsoap.org/ws/2004/09/transfer/GetResponse').up()
      .e('wsa:RelatesTo', 'urn:uuid:7d333fc0-4def-11e3-bf4e-39ab02163fe9').up()
      .e('wsa:To', 'http://www.w3.org/2005/08/addressing/anonymous').up()
    .up()
    .e('s12:Body')
      .e('wsx:Metadata')
        .e('wsx:MetadataSection')
          .att('Dialect', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01/ThisModel')
          .e('dpws:ThisModel')
          if (device.manufacturer) {
            xml.e('dpws:Manufacturer', device.manufacturer, { 'xml:lang': 'en-US' }).up()
          }
          if (device.modelName) {
            xml.e('dpws:ModelName', device.modelName, { 'xml:lang': 'en-EN' }).up()
          }
          if (device.modelNumber) {
            xml.e('dpws:ModelNumber', device.modelNumber).up()
          }
          if (device.modelUrl) {
            xml.e('dpws:ModelUrl', device.modelUrl).up()
          }
          if (device.presentationUrl) {
            xml.e('dpws:PresentationUrl', device.presentationUrl).up()
          }
          xml = xml.up()
        .up()
        .e('wsx:MetadataSection')
          .att('Dialect', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01/ThisDevice')
          .e('dpws:ThisDevice')
          if (device.friendlyName) {
            xml.e('dpws:FriendlyName', device.friendlyName, { 'xml:lang': 'en-EN' }).up()
          }
          if (device.firmwareVersion) {
            xml.e('dpws:FirmwareVersion', device.firmwareVersion).up()
          }
          if (device.serialNumber) {
            xml.e('dpws:SerialNumber', device.serialNumber).up()
          }
          xml = xml.up()
        .up()
        .e('wsx:MetadataSection')
        .att('Dialect', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01/Relationship')
          .e('dpws:Relationship')
          .att('Type', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01/host')
            .e('dpws:Host')
              .e('wsa:EndpointReference')
                .e('wsa:Address', this.device.address).up()
              .up()
              .e('dpws:Types', this.device.types).up()
            .up()

  for (var serviceId in this.services) {
    var service = this.services[serviceId]

    xml
      .e('dpws:Hosted')
        .e('wsa:EndpointReference')
          .e('wsa:Address', this._urlForService(serviceId)).up()
        .up()
        .e('dpws:Types', this.device.types).up()
        .e('dpws:ServiceId', serviceId)
  }

  return xml.end({ pretty: true })
}

Server.prototype._urlForService = function (serviceId) {
  return 'http://' + this._hostnameAndPort() + '/' + serviceId
}

Server.prototype.createService = function (serviceId) {
  var service = this.services[serviceId] = new Service(serviceId, {
    device: this.device
  })

  this.httpServer.post('/' + serviceId, function (req, res, next) {
    res.setHeader('content-type', 'application/soap+xml')

    var tree = et.parse(req.body.toString())

    var action = tree.findtext('*/wsa:Action')
    if (action === 'http://schemas.xmlsoap.org/ws/2004/09/mex/GetMetadata/Request') {
      res.send(service.wsdl())
    }
    else {
      next(new Error('action ' + action + ' not supported'))
    }
  })

  return service
}

module.exports = Server
