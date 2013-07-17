'use strict';

var UserList = function(channel) {
  this.channel = channel;
  this.listElement =
    $('#layout_layout_panel_right').find('.w2ui-panel-content')[0];
};

function createDiv(text) {
  var div = document.createElement('div');
  div.textContent = text;
  div.style.display = 'block';
  return div;
}

UserList.prototype.refresh = function(userList) {
  userList = userList || this.channel.getUsers();
  var fragment = document.createDocumentFragment();
  var userNames = Object.keys(userList).sort();

  for (var i=0, l=userNames.length; i < l; i++)
    fragment.appendChild(createDiv(userNames[i]));

  while (this.listElement.firstChild)
    this.listElement.removeChild(this.listElement.firstChild);

  this.listElement.appendChild(fragment);
};


