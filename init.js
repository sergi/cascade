var Rx = require('Rx');
var path = require('path');
var architect = require('architect');
var util = require('util');
//var gui = require('nw.gui');

var Servers, Actions;
var config = architect.loadConfig(path.join(process.cwd(), 'config.js'));

architect.createApp(config, function(err, app) {
  if (err) {
    throw err;
  }

  Servers = app.getService('servers');

  Actions = Rx.Node.fromEvent(app.getService('eventbus'), 'msgAction')
    .map(function(action) { return action[0]; });

  util.log('Cascade is ready' + util.inspect(app.services));
});

/*
 gui.Window.get().menu = new gui.Menu({
 type: 'menubar'
 });
 */

exports.onload = function() {
  window.Servers = Servers;
  window.Actions = Actions;
  window.Rx = Rx;
};
