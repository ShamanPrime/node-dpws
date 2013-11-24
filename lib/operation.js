var request = require('request')
  , xmlbuilder = require('xmlbuilder')
  , util = require('./util')

function Operation(id, opts, handler) {
  this.id = id
  this.input = opts.input
  this.output = opts.output
  this.handler = handler
  this.event = opts.event
  this.service = opts.service
}

Operation.prototype.removeSubscription = function (identifier) {
  if (!this.subscriptions[identifier]) {
    throw new Error('subscription ' + identifier + ' does not exist')
  }

  delete this.subscriptions[identifier]
}

Operation.prototype.fire = function (data) {
  var self = this

  if (!this.event) {
    throw new Error('operation' + this.id + ' not setup for eventing')
  }

  var subscriptions = this.service.getSubscriptionsByOpId(this.id)

  subscriptions.forEach(function (subscription) {
    var msgId = util.genMessageId()

    var xml = xmlbuilder
      .create('s12:Envelope', { encoding: 'UTF-8', version: '1.0' })
      .att('xmlns:s12', 'http://www.w3.org/2003/05/soap-envelope')
      .att('xmlns:wsa', 'http://www.w3.org/2005/08/addressing')
      .att('xmlns:dpws', 'http://docs.oasis-open.org/ws-dd/ns/dpws/2009/01')
      .e('s12:Header')
        .e('wsa:Action', self.eventResponseUrl).up()
        .e('wsa:MessageId', msgId).up()
        .e('wsa:To', subscription.notifyUrl).up()
        .e('n1:Identifier')
          .att('xmlns:n1', 'http://schemas.xmlsoap.org/ws/2004/08/eventing')
          .att('wsa:IsReferenceParameter', 'true')
          .txt(subscription.identifier)
        .up()
      .up()
      .e('s12:Body')
        .e('i17:' + self.output)
        .att('xmlns:i17', self.serviceUrl)
        .att('xmlns:xs', 'http://www.w3.org/2001/XMLSchema')
        .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')

    var type = self.service.types[self.output]
    if (typeof type === 'string') {
      xml = xml
        .att('xsi:type', 'xs:' + type)
        .txt(data)
    }
    else {
      xml = xml.att('xsi:type', 'i17:' + self.output + 'Type')

      for (var subTypeName in type) {
        var subType = type[subTypeName]
          , datum = data[subTypeName]

        if (!datum) {
          throw new Error(subTypeName + ' not provided in event fire')
        }

        xml = xml
          .e('i17:' + subTypeName)
          .att('xsi:type', 'xs:' + subType)
          .txt(datum)
          .up()
      }
    }

    xml = xml.end({ pretty: true })

    request({
      uri: subscription.notifyUrl,
      method: 'POST',
      headers: {
        'content-type': 'application/soap+xml'
      },
      body: xml
    }, function (err, resp) {
      if (err) {
        console.error('[eventing] delivery to ' + subscription.notifyUrl + ' failed')
        console.error(err.stack)
        return
      }

      if (resp.statusCode !== 202) {
        console.error('[eventing] got response ' + resp.statusCode + ' from ' + subscription.notifyUrl)
      }
    })
  })
}

Operation.prototype.addSubscription = function (identifier, subscription) {
  this.subscriptions[identifier] = subscription
}

module.exports = Operation
