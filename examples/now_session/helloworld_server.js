/* The example of using connect#session in now.
 * By passing the hash table grep around, we store session into the designated
 * user.
 * Try typing 'session' to show this.user.session & this.user.sessionStore. 
 * Try typing 'reload' in the message to sync the this.user.session.
 */
//jQuery tool to merge object.
var jQuery = require('jQuery');
var fs = require('fs');
var connect = require('../../');
//initialize the hash table.
var greq = new Array();
var temp = 0;
var server = require('http').createServer(connect()
  .use(connect.cookieParser('keyboard cat'))
  .use(connect.session({secret: 'keyboard cat'}))
  .use(connect.favicon())
  .use(function(req, response, next){
  //test views
  sess = req.session;
  if (sess.views){
    sess.views++;
  } else {
    sess.views = 1;
  }
  fs.readFile(__dirname+'/helloworld.html', function(err, data){
    response.writeHead(200, {'Content-Type':'text/html'});
    response.write(data);
    response.end();
  });
  //use a hash table to store session. the key is session ID.
  greq[req.sessionID] = {session: req.session, sessionID: req.sessionID, sessionStore: req.sessionStore};
})).listen(8080);

var nowjs = require("now");
var everyone = nowjs.initialize(server);



console.log("gets to work")
nowjs.on("connect", function(){
  console.log("Joined: " + this.now.name);
  //the first half of connect.sid in user's cookie is the same as sessionID
  //thus, we use that to retreive session and merge it into user object.
  id = this.user.cookie["connect.sid"];
  id = id.substring(0, id.indexOf('.'))
  jQuery.extend(this.user, greq[id]);
});

nowjs.on("disconnect", function(){
  console.log("Left: " + this.now.name);
});

everyone.now.displaySession = function (){
  console.log('view times when connected',this.user.session);
  console.log('view times total', this.user.sessionStore);
};

everyone.now.reload = function(){
  this.user.session.reload(function(){});
  //since a request is not sent here, we need to redirect this.user.session
  //this.user.session = this.user.session.req.session;
};
everyone.now.distributeMessage = function(message){
  everyone.now.receiveMessage(this.now.name, message);
};
