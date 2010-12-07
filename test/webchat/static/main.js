
////////////////////////////////////////////////////////////////////////

$(document).ready(function() {
  var relay = new relayio.RelayClient("test",["write_key", "read_key"]);
  relay.connect(function () {
    console.log("I have connected");
    relay.join("#rabbits", function (err, chan) {
      if (err) throw err;
      console.log("NEW CHAN: ");
      console.log(chan);
    });
  });
});


