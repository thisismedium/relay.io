var map = require("iterators").map;
function autoMakeRecords (data) {
  if (data instanceof Object) {
    if (data instanceof Array) {
      return map(autoMakeRecords, data);
    } else {
      return (new (autoRecord())).load(data);
    }
  } else {
    return data;
  }
}

function autoDumpRecords (data) {
  for (k in data) {
    if ((data[k] instanceof Object) && data[k]._data_) {
      data[k] = data[k]._data_;
    }
  }
  return data;
}

function autoRecord (init) {
  if (init){
    var obj = init;
  } else {
    var obj = function(){};
  }
  obj._data_ = {};
  obj.prototype.dump = function () { return autoDumpRecords(this._data_) };
  obj.prototype.load = function (data) {
    if (typeof(this._data_) == "undefined") {
      this._data_ = data;
    } else {
      for (k in data) {
        this._data_[k] = data[k];
      }
    }
    for (k in data) {
      if (data.hasOwnProperty(k) && typeof(data[k]) != "function"){
        (function (self, key) {
          var turkey = key[0].toUpperCase() + key.slice(1);
          if (!self['get' + turkey])
            self['get' + turkey] = function () {
              return autoMakeRecords(self._data_[key]);
            };
          if (!self['set' + turkey])
            self['set' + turkey] = function (v) {
              self._data_[key] = v; return self;
            };
        })(this,k);
      }
    };
    return this;
  };
  return obj;
};
exports.autoRecord = autoRecord;

// autoMessage wraps autoRecord and adds a few methods...
function autoMessage (fn) {
  return autoRecord(function () {
    this.replyWith = function (replyMesg) {
      if (this.getMesgId) replyMesg._data_.mesgId = this.getMesgId();
      return replyMesg;
    };
    if (fn) fn.apply(this, arguments);
  });
}
exports.autoMessage = autoMessage;