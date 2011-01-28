define(['exports', 'relay-core/api', './protocol', './util'],
function(exports, CoreApi, P, U) {

  
  // ## Protocol ##

  var protocol = {

    Error: function(err, status, orig) {
      return P.message('Error')
        .status(status || 500)
        .body({ message: (err && err.toString()), orig: orig });
    },

    
    // ## Logger connects to Archive ##
    //
    // A logger in the Relay network (e.g. Station) connects to the
    // archive server to push logs in at some hearbeat interval.
    //
    //     L: Source
    //     A: OK
    //     L: Push ...
    //     L: Push ...
    //     ...

    Source: function() {
      return P.message('Source');
    },

    OK: function() {
      return P.message('Ok')
        .status(200);
    },

    Push: function(quantum) {
      return P.message('Push')
        .body(quantum.dump());
    },

    
    // ## Website wants stats ##
    //
    // A website wants to display statistics about a particular app or
    // channel. It asks to subscribe, the Archive responds with a
    // current summary, then sends incremental updates.
    //
    //     W: Subscribe #app
    //     A: Update ...
    //     A: Update ...
    //     ....
    //     W: Cancel #app
    //     A: OK

    Subscribe: function(app, channel) {
      return P.message('Subscribe')
        .body({ app: app, channel: channel || null });
    },

    Update: function(entries) {
      return P.message('Update')
        .body('record', entries.map(function(entry) {
          return entry.dump();
        }));
    },

    Cancel: function(app, channel) {
      return P.message('Cancel')
        .body({ app: app, channel: channel || null });
    }
  };

  U.extend(exports, protocol);

  
  // ## Marshalling ##

  exports.inspectMessage = function(data) {
    return P.Message.load(data);
  };

});