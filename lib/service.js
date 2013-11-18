var Operation = require('./operation.js')
  , xmlbuilder = require('xmlbuilder')
  , util = require('./util')
  , et = require('elementtree')

function Service(id, opts) {
  this.id = id
  this.operations = {}
  this.url = null
  this.device = opts.device
}

Service.prototype.getOpByAction = function (action) {
  for (var opId in this.operations) {
    var op = this.operations[opId]

    if (action === this.url + '/' + opId) {
      return op
    }
  }

  return null
}

Service.prototype.handleAction = function (body, cb) {
  var self = this
  var tree = et.parse(body.toString())

  var action = tree.findtext('*/wsa:Action')
    , msgId = tree.findtext('*/wsa:MessageID')

  if (action === 'http://schemas.xmlsoap.org/ws/2004/09/mex/GetMetadata/Request') {
    return cb(null, this.wsdl({
      relatesTo: msgId
    }))
  }

  var operation = this.getOpByAction(action)
  if (!operation) {
    cb(new Error('action ' + action + ' not supported'))
  }

  var input
  if (operation.input) {
    var inputType = operation.types[operation.input]

    if (typeof inputType === 'string') {
      input = tree.findtext('*/n1:' + operation.input)
    }
    else {
      input = {}
      for (var inputName in inputType) {
        input[inputName] = tree.findtext('*/*/n1:' + inputName)
      }
    }
  }

  operation.handler(input, function (err, res) {
    var xml = xmlbuilder
      .create('s12:Envelope', { encoding: 'UTF-8', version: '1.0' })
      .att('xmlns:s12', 'http://www.w3.org/2003/05/soap-envelope')
      .att('xmlns:wsa', 'http://www.w3.org/2005/08/addressing')
      .e('s12:Header')
        .e('wsa:Action', operation.outputAction).up()
        .e('wsa:RelatesTo', msgId).up()
        .e('wsa:MessageID', util.genMessageId()).up()
      .up()
      .e('s12:Body')

    if (operation.output) {
      var outputTypeName = operation.output
        , outputType = operation.types[operation.output]

      xml = xml
        .e('n1:' + outputTypeName)
        .att('xmlns:n1', self.url)
        .att('xmlns:n2', 'http://www.w3.org/2001/XMLSchema')
        .att('xmlns:n3', 'http://www.w3.org/2001/XMLSchema-instance')

      if (typeof outputType === 'string') {
        xml = xml.att('n3:type', 'n2:' + outputType).txt(res)
      }
      else {
        throw new Error('complex response not supported yet')
      }
    }

    cb(null, xml.end({ pretty: true }))
  })
}

Service.prototype._operationInputAction = function (opId) {
  return this.url + '/' + opId
}

Service.prototype._operationOutputAction = function (opId) {
  return this.url + '/' + opId + 'Response'
}

Service.prototype.createOperation = function (operationId, opts, handler) {
  var op = this.operations[operationId] = new Operation(operationId, opts, handler)

  return op
}

Service.prototype.wsdl = function (data) {
  var xml = xmlbuilder
    .create('s12:Envelope', { encoding: 'UTF-8', version: '1.0' })
    .att('xmlns:dpws', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01')
    .att('xmlns:s12', 'http://www.w3.org/2003/05/soap-envelope')
    .att('xmlns:wsa', 'http://www.w3.org/2005/08/addressing')
    .att('xmlns:wsx', 'http://schemas.xmlsoap.org/ws/2004/09/mex')
    .e('s12:Header')
      .e('wsa:Action', 'http://schemas.xmlsoap.org/ws/2004/09/mex/GetMetadata/Response').up()
      .e('wsa:RelatesTo', data.relatesTo).up()
      .e('wsa:To', 'http://www.w3.org/2005/08/addressing/anonymous').up()
    .up()
    .e('s12:Body')
      .e('wsx:Metadata')
        .e('wsx:MetadataSection')
        .att('Dialect', 'http://schemas.xmlsoap.org/wsdl/')
          .e('wsdl:definitions')
          .att('xmlns:tns', this.url)
          .att('xmlns:wsdl', 'http://schemas.xmlsoap.org/wsdl/')
          .att('xmlns:dpws', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01')
          .att('xmlns:wsoap12', 'http://schemas.xmlsoap.org/wsdl/soap12/')
          .att('xmlns:xs', 'http://www.w3.org/2001/XMLSchema')
          .att('xmlns:wsam', 'http://www.w3.org/2007/05/addressing/metadata')
          .att('targetNamespace', this.url)
            .e('wsdl:types')
              .e('xs:schema')
              .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
              .att('targetNamespace', this.url)
              .att('elementFormDefault', 'qualified')
              .att('attributeFormDefault', 'unqualified')

  var opId, op

  for (opId in this.operations) {
    var types = this.operations[opId].types

    for (var typeName in types) {
      var type = types[typeName]

      if (typeof type === 'string') {
        xml = xml
          .e('xs:element')
          .att('name', typeName)
          .att('type', 'xs:' + type)
          .up()
      }
      else {
        xml = xml
          .e('xs:element')
          .att('name', typeName)
          .att('type', 'tns:' + typeName + 'Type')
          .up()
          .e('xs:complexType')
          .att('name', typeName + 'Type')
            .e('xs:all')

        for (var subTypeName in type) {
          var subType = type[subTypeName]

          xml = xml
            .e('xs:element')
            .att('name', subTypeName)
            .att('type', 'xs:' + subType)
            .up()
        }

        xml = xml.up().up()
      }
    }
  }

  xml = xml.up().up()

  for (opId in this.operations) {
    op = this.operations[opId]

    xml = xml.e('wsdl:message').att('name', opId + 'Message')
    if (op.input) {
      xml = xml
        .e('wsdl:part')
        .att('name', 'parameters')
        .att('element', 'tns:' + op.input)
        .up()
    }

    xml = xml.up()

    xml = xml.e('wsdl:message').att('name', opId + 'ResponseMessage')
    if (op.output) {
      xml = xml
        .e('wsdl:part')
        .att('name', 'parameters')
        .att('element', 'tns:' + op.output)
        .up()
    }

    xml = xml.up()
  }

  xml = xml.e('wsdl:portType').att('name', this.device.types)

  for (opId in this.operations) {
    op = this.operations[opId]

    xml = xml
      .e('wsdl:operation')
      .att('name', opId)
        .e('wsdl:input')
        .att('name', opId)
        .att('message', 'tns:' + opId + 'Message')
        .att('wsam:Action', this._operationInputAction(opId))
        .up()
        .e('wsdl:output')
        .att('name', opId + 'Response')
        .att('message', 'tns:' + opId + 'ResponseMessage')
        .att('wsam:Action', this._operationOutputAction(opId))
        .up()
      .up()
  }

  xml = xml
    .up()
    .e('wsdl:binding')
    .att('name', this.id + 'Binding')
    .att('type', 'tns:AC_serviceInterface')
      .e('wsoap12:binding')
      .att('style', 'document')
      .att('transport', 'http://schemas.xmlsoap.org/soap/http')
      .up()

  for (opId in this.operations) {
    op = this.operations[opId]

    xml = xml
      .e('wsdl:operation')
      .att('name', opId)
        .e('wsoap12:operation').up()
        .e('wsdl:input')
          .e('wsoap12:body').att('use', 'literal').up()
        .up()
        .e('wsdl:output')
          .e('wsoap12:body').att('use', 'literal').up()
        .up()
      .up()
  }

  xml = xml
  .e('wsdl:service')
  .att('name', this.id)
    .e('wsdl:port')
    .att('name', this.id)
    .att('binding', 'tns:' + this.id + 'Binding')
      .e('wsoap12:address')
      .att('location', this.url)
      .up().up().up().up().up().up()
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
      .e('dpws:Hosted')
      .e('wsa:EndpointReference')
        .e('wsa:Address', this.url).up()
      .up()
      .e('dpws:Types', this.device.types).up()
      .e('dpws:ServiceId', this.id).up()
        

  return xml.end({ pretty: true })
}

module.exports = Service
