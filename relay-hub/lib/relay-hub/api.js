define(['exports', 'relay-core/protocol', 'relay-core/util'],
function(exports, Proto, U) {
  var Api = this.exports = Proto.protocol('Station') 
    .type({
      RegisterStation: function (key) {
        return Api.message("RegisterStation")
          .body(key)
      },
      GetApplicationData: function (appId) {
        return Api.message("GetApplication")
          .attr("to", appId)
      },
      CreateApplication: function () {
        return Api.message("CreateApplication");
      },
      ApplicationData: function (adata) {
        return Api.message("ApplicationData")
          .body(adata.dump())
      },
      PermissionDeniedError: function () {
        return Api.message("Error")
          .body({"code": 503, "message": "Permission Denied"});
      },
      Okay: function () {
        return Api.message("Okay")
      }
    })
    .api()
});
  
