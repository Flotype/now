// https://github.com/DTrejo/run.js
// Used to run code in a directory and rerun it if any files are changed.
// usage: node run.js servercode.js
// servercode.js is whatever js file you want to run with node.

// Excludes filetypes in the ignoreExtensions array
var sys = require('sys'),
  fs = require('fs'), 
  spawn = require('child_process').spawn,
  child, // child process which runs the actual code
  ignoreExtensions = ['.dirtydb', '.db'];

if (process.argv.length !== 3){
  console.log('\n\nFound ' + (process.argv.length - 1) + ' argument(s). Expected two.');
  console.log('Usage: \nnode run.js servercode.js\n');
  return;
}
  
run();
watchFiles(parseFolder('.'), restart); // watch all files, restart if problem

// executes the command given by the second argument
function run() {
  // run the server
  child = spawn('node', [process.argv[2]]);

  // let the child's `puts` escape.
  child.stdout.on('data', function(data) { 
    sys.print(data);
  });
  child.stderr.on('data', function(error) { 
    sys.print(error);
    // this allows the server to restart when you change a file. Hopefully the change fixes the error!
    // child = undefined;
  });

  console.log('\nStarting: ' + process.argv[2]);
}

function restart() { 
  // kill if running
  if (child) child.kill();

  // run it again
  run();
}

/**
* Parses a folder and returns a list of files
*
* @param root {String}
* @return {Array}
*/
function parseFolder(root) {
  var fileList = []
    , files = fs.readdirSync(root);

  files.forEach(function(file) {
    var path = root + '/' + file
      , stat = fs.statSync(path);
    
    // add to list
    if (stat !== undefined && !stat.isDirectory()) {
      fileList.push(path);
    }

    // recur if directory, ignore dot directories
    if (stat !== undefined && stat.isDirectory() && file.indexOf('.') !== 0) {
      fileList = fileList.concat(parseFolder(path));
    }
  });
  return fileList;
}


/**
* Adds change listener to the files
*
* @param files {Array}
*/
function watchFiles(files, callback) {

var config = {  persistent: true, interval: 1 };
  console.log('watched files:');

  files.forEach(function (file) {  

    // don't watch things with given extensions, don't watch dotfiles.
    var ext = file.slice(file.lastIndexOf('.'), file.length);
    if (ignoreExtensions.indexOf(ext) !== -1 || file.indexOf('./.') === 0) {
      // console.log('ignored ' + file);
      return;
    }

    console.log(file);
  
    // if one of the files changes
    fs.watchFile(file, config, function (curr, prev) {

      if ((curr.mtime + '') != (prev.mtime + '')) {
        console.log(file + ' changed');

        if (callback !== undefined) {
          callback();
        }
      }
    });
  });
}