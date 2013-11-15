var url = require('url');
var util = require('util');
var Rx = require('rx');

module.exports = function setup(options, imports, register) {
  var actions = [];
  var messages = imports.servers.reduce(function(p, c) {
    return p.observables.channelMessages.merge(c.observables.channelMessages);
  });

  messages
    .filter(function(msg) { return msg.urls.length > 0; })
    // Transform observable in a way that it yields an object with exactly
    // one URL and one hash on every iteration.
    .flatMap(function(msg) {
      return Rx.Observable.fromArray(msg.urls.map(function(_url) {
        return {
          url: url.parse(_url),
          hash: msg.hash
        };
      }));
    })
    .subscribe(function(msg) {
      actions.forEach(function(action) {
        action.check(msg.url) && action.process(msg.url, function(result) {
          if (!result) return;

          imports.eventbus.emit('urlAction', {
            hash: msg.hash,
            action: result
          });
        });
      });
    });

  register(null, {
    actionList: actions
  });
};
