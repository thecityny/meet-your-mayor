const fs = require("fs");
const {create} = require('xmlbuilder2');

module.exports = function(grunt) {
  grunt.registerTask("sitemap", "Generate sitemap file", function() {
    const candidateData = grunt.data.json.candidateData;
    const topicDisplayData = grunt.data.json.topicDisplayData;
    const topicData = grunt.data.json.topicData;
    const archieml = grunt.data.archieml;
    
    const host = "https://projects.thecity.nyc/meet-your-mayor";
    const topicLastUpdated = getLastUpdated();

    // Most recent change across all topics, for Ultimate Match
    const ultimateMatchDate = new Date(2021, 5, 1);
    const dates = Object.values(topicLastUpdated).reduce((dates, topicDate) => [
      ...dates,
      topicDate
    ], []);
    const lastUpdated = [...dates, ultimateMatchDate].sort((a, b) => b.getTime() - a.getTime())[0];

    // Ultimate Match
    const ultimateMatch = {
      loc: `${host}/ultimate-match.html`,
      lastmod: formatDate(lastUpdated)
    }

    // Topic pages
    const topics = topicData.map(d => {
      return {
        loc: `${host}/${d.topic}.html`,
        lastmod: formatDate(topicLastUpdated[d.topic])
      };
    });

    // Candidate pages
    const candidatesDate = new Date(2021, 5, 2);
    const candidates = Object.keys(candidateData).map(slug => {
      return {
        loc: `${host}/candidates/${slug}.html`,
        lastmod: formatDate(candidatesDate)
      };
    });
  
    // Build the sitemap
    const urls = [ultimateMatch, ...topics, ...candidates];
    const doc = create({
      urlset: {
        "@xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
        url: urls
      }
    });
    const xml = doc.end({prettyPrint: true});
    grunt.file.write("build/sitemap.xml", xml);

    // Format to yyyy-mm-ddThh:mm:ss+00:00
    function formatDate(date) {
      return new Date(date.setUTCMilliseconds(0)).toISOString().replace(/.000Z$/, "+00:00");
    }

    // Get date of most recent change for each topic
    function getLastUpdated() {
      return topicData.reduce((lastUpdated, {topic, candidates}) => {
        // Pub date
        const topicDate = new Date(topicDisplayData[topic].date);
        
        // Change log
        const topicChanges = archieml[topic] && archieml[topic].changes || [];
        const changeDates = topicChanges.map(change => new Date(change.date));
        
        // Dropouts
        const topicDropouts = candidates.reduce((topicDropouts, candidateSlug) => {
          const candidate = candidateData[candidateSlug];

          if (candidate.droppedOutDate) {
            return [...topicDropouts, new Date(candidate.droppedOutDate).getTime()];
          } else {
            return topicDropouts;
          }
        }, []);

        const latestDate = [topicDate, ...changeDates, ...topicDropouts].sort((a, b) => b.getTime() - a.getTime())[0];
        return {
          ...lastUpdated,
          [topic]: latestDate
        };
      }, {});
    }
  });
}
