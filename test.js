var dpws = require('dpws')

var server = dpws.createServer({
  host: '192.168.1.2',
  device: {
    address: 'f7ef0fab-ba1d-4275-9a94-0f051090640f',
    types: 'i2:AC_serviceInterface',
    metadataVersion: '54325432',
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

var service = server.createService('AC_Service')

var op = service.createOperation('GetStatus', {
  types: {
    'temp': 'int'
  },
  output: {
    'temp': 'temp'
  }
})

server.listen(8080, function (err) {
  if (err) {
    throw err
  }

  console.log('listening')
})

process.on('SIGINT', function () {
  server.bye(process.exit)
})
