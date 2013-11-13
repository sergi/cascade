var Rx = require('Rx');
var path = require("path");
var architect = require("architect");
//var gui = require('nw.gui');

console.log('node-webkit version:', process.versions['node-webkit']);

var Servers;

var config = architect.loadConfig(path.join(process.cwd(), 'js', 'config.js'));
architect.createApp(config, function(err, app) {
  if (err) throw err;
  Servers = app.services.servers;

  console.log("Cascade is ready", app);
});

/*
 gui.Window.get().menu = new gui.Menu({
 type: 'menubar'
 });
 */

exports.onload = function() {
  window.Servers = Servers;
  window.Rx = Rx;
};
