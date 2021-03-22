/*
Build a bundled app.js file using browserify
*/
module.exports = function(grunt) {

  var async = require("async");
  var babel = require("babelify");
  var browserify = require("browserify");
  var exorcist = require("exorcist");
  var fs = require("fs");

  grunt.registerTask("bundle", "Build app.js using browserify", function(mode) {
    //run in dev mode unless otherwise specified
    mode = mode || "dev";
    var done = this.async();

    //specify starter files here - if you need additionally built JS, just add it.
    var config = grunt.file.readJSON("project.json");
    var seeds = config.scripts;

    async.forEachOf(seeds, function(dest, src, c) {
      var b = browserify({ debug: false });
      b.transform("babelify", {
        global: true, 
        sourceMaps: false,
        presets: [
          ['@babel/preset-env'],
          ["@babel/preset-react", {}]
        ],
        ignore: [/[\/\\]core-js/, /@babel[\/\\]runtime/],
        plugins: [
          ["@babel/plugin-proposal-object-rest-spread"],
          ["@babel/plugin-transform-runtime", {
            "regenerator": true,
            "corejs": 3
          }]
        ]
      });
      b.plugin("tinyify");

      //make sure build/ exists
      grunt.file.mkdir("build");
      var output = fs.createWriteStream(dest);

      b.add(src);
      var assembly = b.bundle();

      assembly.on("error", function(err) {
        grunt.log.errorlns(err.message);
        done();
      });
      var mapFile = dest + ".map"

      if (mode == "dev") {
        //output sourcemap
        // assembly = assembly.pipe(exorcist(mapFile, null, null, "."));
      }
      assembly.pipe(output).on("finish", function() {
        if (mode != "dev") return;

        //correct path separators in the sourcemap for Windows
        // var sourcemap = grunt.file.readJSON(mapFile);
        // sourcemap.sources = sourcemap.sources.map(function(s) { return s.replace(/\\/g, "/") });
        // grunt.file.write(mapFile, JSON.stringify(sourcemap, null, 2));

        c();
      });
    }, done);

  });

};
