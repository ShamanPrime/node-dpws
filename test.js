var dpws = require('dpws')

var server = dpws.createServer({
  host: '192.168.1.2',
  device: {
    address: 'f7ef0fab-ba1d-4275-9a94-0f051090640f',
    types: '_PORT_TYPE_',
    metadataVersion: Date.now().toString(),
    manufacturer: '_MANUFACTURER_',
    modelName: '_MODEL_NAME_',
    modelNumber: '_MODEL_NUMBER_',
    modelUrl: 'http://example.com/_MODEL_URL',
    presentationUrl: 'http://example.com/_PRESENTATION_URL',
    friendlyName: '_FRIENDLY_NAME_',
    firmwareVersion: '0.0.1',
    serialNumber: '12345'
  }
})

var service = server.createService('_SERVICE_ID_')

var temp = 0

service.createOperation('GetStatus', {
  types: {
    't1': 'int'
  },
  output: 't1'
}, function (input, cb) {
  setImmediate(cb.bind(null, null, temp))
})

service.createOperation('SetTemperature', {
  types: {
    't2': 'int'
  },
  input: 't2'
}, function (input, cb) {
  temp = parseInt(input, 10)
  setImmediate(cb)
})

var tempEvent = service.createOperation('TemperatureEvent', {
  event: true,
  types: {
    'complex': {
      't1': 'int',
      't2': 'int'
    },
    'simple': 'int'
  },
  output: 'simple'
})

setInterval(function () {
  tempEvent.fire(temp.toString())
  temp += 1
}, 1000)

server.listen(8080, function (err) {
  if (err) {
    throw err
  }

  console.log('listening')
})

process.on('SIGINT', function () {
  server.bye(process.exit)
})
