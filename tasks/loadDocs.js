var { google } = require("googleapis");
var async = require("async");
var os = require("os");
var path = require("path");
var { authenticate } = require("./googleauth");
var url = require('url');
var htmlparser = require('htmlparser2');
var Entities = require('html-entities').AllHtmlEntities;

var docs = require('../data/topicData.json').reduce((docs, topic) => {
  return {...docs, [topic.doc]: topic.topic}
}, {});

module.exports = function(grunt) {

  grunt.registerTask("docs", "Load Google Docs into the data folder", function() {

    var config = grunt.file.readJSON("project.json");
    var auth = null;
    try {
      auth = authenticate();
    } catch (err) {
      console.log(err);
      return grunt.fail.warn("Couldn't load access token for Docs, try running `grunt google-auth`");
    }

    var done = this.async();

    var drive = google.drive({ auth, version: "v3" });

    /*
     * Large document sets may hit rate limits; you can find details on your quota at:
     * https://console.developers.google.com/apis/api/drive.googleapis.com/quotas?project=<project>
     * where <project> is the project you authenticated with using `grunt google-auth`
     */
    async.eachLimit(
      Object.keys(docs),
      2, // adjust this up or down based on rate limiting
      async function(fileId) {
        var meta = await drive.files.get({ fileId, supportsAllDrives: true });
        var name = docs[fileId] + ".docs.txt";
        var body = await drive.files.export({ fileId, mimeType: "text/html", supportsAllDrives: true });
        var text = body.data.trim().replace(/\r\n/g, "\n");
        // replace triple breaks with regular paragraph breaks
        text = text.replace(/\n{3}/g, "\n\n");
        // force fields to be lower-case
        text = text.replace(/^[A-Z]\w+\:/m, w => w[0].toLowerCase() + w.slice(1));
        // strip out footnotes from the end
        var lines = text.split("\n");
        var line;
        var refs = [];
        while (line = lines.pop()) {
          var match = line.match(/^\[(\w+)\]|_(re)?assigned to.+_/i);
          if (!match) {
            lines.push(line);
            break;
          }
          refs.push(match[1]);
        }
        text = lines.join("\n");
        // remove the footnote references from the rest of the doc
        refs = refs.filter(n => n);
        if (refs.length) {
          var replacer = new RegExp(`\\[(${refs.join("|")})\\]`, "g");
          text = text.replace(replacer, "");
        }
        console.log(`Writing document as data/${name}`);

        var handler = new htmlparser.DomHandler(function(error, dom) {
          var tagHandlers = {
            _base: function (tag) {
              var str = '';
              tag.children.forEach(function(child) {
                if (func = tagHandlers[child.name || child.type]) str += func(child);
              });
              return str;
            },
            text: function (textTag) {
              return textTag.data;
            },
            span: function (spanTag) {
              return tagHandlers._base(spanTag);
            },
            p: function (pTag) {
              return tagHandlers._base(pTag) + '\n';
            },
            a: function (aTag) {
              var href = aTag.attribs.href;
              if (href === undefined) return '';

              // extract real URLs from Google's tracking
              // from: http://www.google.com/url?q=http%3A%2F%2Fwww.nytimes.com...
              // to: http://www.nytimes.com...
              if (aTag.attribs.href && url.parse(aTag.attribs.href,true).query && url.parse(aTag.attribs.href,true).query.q) {
                href = url.parse(aTag.attribs.href,true).query.q;
              }

              var str = '<a href="' + href + '">';
              str += tagHandlers._base(aTag);
              str += '</a>';
              return str;
            },
            li: function (tag) {
              return '* ' + tagHandlers._base(tag) + '\n';
            }
          };

          ['ul', 'ol'].forEach(function(tag) {
            tagHandlers[tag] = tagHandlers.span;
          });
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function(tag) {
            tagHandlers[tag] = tagHandlers.p;
          });

          var body = dom[0].children[1];
          var parsedText = tagHandlers._base(body);

          // Convert html entities into the characters as they exist in the google doc
          var entities = new Entities();
          parsedText = entities.decode(parsedText);

          // Remove smart quotes from inside tags
          parsedText = parsedText.replace(/<[^<>]*>/g, function(match){
            return match.replace(/”|“/g, '"').replace(/‘|’/g, "'");
          });

          // var parsed = archieml.load(parsedText);

          grunt.file.write(path.join("data", name), parsedText);
        });

        var parser = new htmlparser.Parser(handler);

        parser.write(text);
        parser.done();
      },
      done
    );

  });
}
