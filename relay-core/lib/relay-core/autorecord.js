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

function autoRecord (init) {
  if (init){
    var obj = init;
  } else {
    var obj = function(){};
  }
  obj._data_ = {};
  obj.prototype.dump = function () { return this._data_ };
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
          var tcheck = isTypeOf.curry(typeof(self._data_[key]));
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
