var url = require('url');
var util = require('util');
var bz = require("bz-json");

var client = bz.createClient({
  url: "https://bugzilla.mozilla.org/jsonrpc.cgi"
});

module.exports = function setup(options, imports, register) {
  var bus = imports.eventbus;
  var messages = imports.servers.reduce(function(p, c) {
    return p.observables.channelMessages.merge(c.observables.channelMessages);
  });

  messages.subscribe(function(msg) {
    msg.urls.forEach(function(_url) {
      var parsed = url.parse(_url);
      if (parsed.host === 'bugzilla.mozilla.org' && typeof parsed.query === 'string') {
        var id = parsed.query.split('=')[1];
        if (id) {
          client.getBug(id, function(error, bug) {
            if (error) {
              console.error(error);
              return;
            }

            var result = bug.result.bugs[0];
            if (result) {
              bus.emit('msgAction', {
                hash: msg.hash,
                content: result.summary
              });
            }
          });
        }
      }
    });
  });

  register(null);
};
