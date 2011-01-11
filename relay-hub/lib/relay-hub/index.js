var serverMedium = require("servermedium");
var settings = serverMedium.requireHostSettings();
var ADB = require("./ApplicationDatabase");

var AppDB = new ADB.ApplicationDatabase(settings.application_database_path);
AppDB.getApplicationData("test", function(data) {
  console.log(data);
});
