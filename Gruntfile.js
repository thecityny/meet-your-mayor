module.exports = function(grunt) {

  //load tasks
  grunt.loadTasks("./tasks");

  // Load data
  grunt.registerTask("content", "Load content from data files", ["state", "json", "csv", "markdown", "archieml"]);
  // Load data and build templates
  grunt.registerTask("template", "Build HTML from content/templates", function(env) {
    if (env) {
      grunt.task.run(["content", `build:${env}`]);
    } else {
      grunt.task.run(["content", "build"]);
    }
  });

  // Build js, css and templates
  grunt.registerTask("static", "Build all files", function(env) {
    if (env) {
      grunt.task.run([`bundle:${env}`, `less:${env}`, `template:${env}`]);
    } else {
      grunt.task.run(["bundle", "less", "template"]);
    }
  });

  // Clean and build js, css, templates and copy assets
  grunt.registerTask("default", ["clean", "static", "copy"]);
  // Watch essentially runs static:dev
  grunt.registerTask("start", "Build files and start live reload server", ["clean", "static:dev", "copy", "connect:dev", "watch"]);
};
