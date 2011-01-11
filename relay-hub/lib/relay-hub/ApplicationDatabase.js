var tc = require("node-tokyocabinet");
var api = require("relay-core/api");

var ApplicationDatabase = function ApplicationDatabase (path) {
  
  var read   = 'r+';
  var write  = 'w+';
  var append = 'a+';
  
  function getDB (mode, callback) {
    var db = new tc.HashDB();
    db.open(path, mode, function(err) {
      if (err) throw err;
      callback(err, db);
    });
  };
  
  this.getApplicationData = function getApplicationData (appId, callback) {
    getDB(read, function (err, db) {
      if (err) throw err;
      db.get(appId, function(err, data) {
        if (err) {
          callback(null);
        } else {
          callback(JSON.parse(data));
        }
      });
    });
  };

  this.putApplicationData = function putApplicationData (appId, data, callback) {
    getDB(write, function (err, db) {
      if (err) throw err;
      db.put(appId, JSON.stringify(data.dump()), callback);
    });
  };

};

keys = [new Key("test", "write, read")]
app  = new api.ApplicationData (keys);
console.log(JSON.stringify(app.dump()))

exports.ApplicationDatabase = ApplicationDatabase;
