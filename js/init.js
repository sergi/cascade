var irc = require('irc');
var gui = require('nw.gui');
var fs = require('fs');
var Rx = require('Rx');

gui.Window.get().menu = new gui.Menu({
  type: 'menubar'
});

var Config = JSON.parse(fs.readFileSync('config.json', {
  encoding: 'utf8'
}));

function cleanName(name) {
  if (name[0] === '#')
    return name.substr(1, name.length - 1);

  return name;
}

function getChannelEl(name) {
  return document.getElementById('channel-pane-' + cleanName(name));
}

function markURL(obj) {
  var re = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
  obj.text = obj.text.replace(re, '<a href="#" onclick="gui.Shell.openExternal(\'$1\');">$1</a>');
  return obj;
}
