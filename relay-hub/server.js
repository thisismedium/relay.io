process.on('uncaughtException', function (err) {
  console.log(err.stack);
  console.log('Caught exception: ' + err);
});

require("relay-hub").app();