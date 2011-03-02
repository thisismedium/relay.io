var tc    = require("node-tokyocabinet/tcasync");
var api   = require("relay-core/api");

var ApplicationDatabase = function ApplicationDatabase (path) {
  
  if (!path) throw "ApplicationDatabase: Path not provided!";

  var self = this;
  
  var waiting = [];

  var db = new tc.HashDB();

  db.open(path, "a+", function (err) {
    if (err) throw err
    while (waiting.length > 0) {
      waiting.pop()(db);
    }
  });

  function whenAvailable (fn) {
    if (db.db) {
      fn(db);
    } else {
      waiting.push(fn);
    }
  }

  this.getApplicationData = function (appId, callback) {
    whenAvailable(function (db) {
      db.get(appId, function(err, data){
        if (err || !data) {
          return callback(null);
        } else {
          return callback(new api.Application(JSON.parse(data)));
        }
      })
    });
  };

  this.putApplicationData = function (data, callback) {
    whenAvailable(function(db) {
      if (!(data instanceof api.Application)) throw "data provided is not Application data!";
      db.put(data.getAddress(), JSON.stringify(data.dump()), callback)
    });
  }
                  
  this.close = function (callback) {
    whenAvailable(function (db) {
      db.close(callback)
    });
  }
};

exports.ApplicationDatabase = ApplicationDatabase;
