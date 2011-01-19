var tc  = require("node-tokyocabinet/tcasync");
var api = require("relay-core/api");

var ApplicationDatabase = function ApplicationDatabase (path) {
  
  if (!path) throw "ApplicationDatabase: Path not provided!"

  var self = this;

  this.db = null;

  function withDB (callback) {
    if (!self.db) {
      self.db = new tc.HashDB();
      self.db.open(path, "a+", function(err) {
        if (err) throw (err);
        callback(err, self.db);
      });
    } else {
      callback(null, self.db);
    }
  };
  
  this.getApplicationData = function getApplicationData (appId, callback) {
    withDB(function (err, db) {
      if (err) throw err;
      db.get(appId, function(err, data) {
        if (err) {
          callback(err, null);
        } else {
          callback(err, JSON.parse(data));
        }
        db.close(function(){})
      });
    });
  };

  this.putApplicationData = function putApplicationData (appId, data, callback) {
    withDB(function (err, db) {
      if (err) throw err;
      db.put(appId, JSON.stringify(data.dump()), callback);
    });
  };

};

exports.ApplicationDatabase = ApplicationDatabase;
