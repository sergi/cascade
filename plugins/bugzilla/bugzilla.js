var util = require('util');
var bz = require("bz-json");

var client = bz.createClient({
  url: "https://bugzilla.mozilla.org/jsonrpc.cgi"
});

module.exports = function setup(options, imports, register) {
  function check(url) {
    return url.host === 'bugzilla.mozilla.org' && typeof url.query === 'string';
  }

  function process(url, callback) {
    var id = url.query.split('=')[1];
    if (id) {
      return client.getBug(id, function(error, bug) {
        if (error) {
          util.error(error);
          callback(null);
        }

        var result = bug.result.bugs[0];
        callback({
          name: 'bugzilla', //plugin name
          template: 'bugzilla.html',
          css: 'bugzilla.css',
          title: result.summary
        });
      });
    }

    callback(null);
  }

  imports.actionList.push({
    check: check,
    process: process
  });

  register(null);
};
