let Snoowrap = require('snoowrap');
let Parser = require('rss-parser');
let { Client } = require('pg');
let PropertiesReader = require('properties-reader');

var properties = new PropertiesReader('./env.properties');

let parser = new Parser();

const r = new Snoowrap({
    userAgent: properties.get('userAgent'),
    clientId: properties.get('clientId'),
    clientSecret: properties.get('clientSecret'),
    username: properties.get('username'),
    password: properties.get('password')
});

var feeds = properties.get('feeds');
var rss_feeds = feeds.split(',');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect();
setTimeout(function() { client.end }, 15000);

var post_history = new Array();

try {
    response = client.query('select link from public.post_log',
        function(err, result) {
            if(err) {
                console.log(err.message);
            }
            else {
                result.rows.forEach(function(row) {
                    post_history.unshift(row.link);
                })
            }
        });
    setTimeout(postToReddit, 5000);
} catch (e) {
    console.log(e);
}

function postToReddit() {
    rss_feeds.forEach(function(site) {
        (async () => {
            let feed = await parser.parseURL(site);
            feed.items.forEach(item => {
                if(!post_history.includes(item.link)) {
                    r.getSubreddit(properties.get('targetSubreddit')).submitLink({
                        title: item.title,
                        url: item.link
                    });
                    addToLoadHistory(item.link);
                }
            });
        })();
    });
}

function addToLoadHistory(link) {
    try {
        client.query('insert into post_log (post_date, link) values ($1, $2)', [new Date(), link],
            function(err, result) {
                if(err) {
                    console.log(err.message);
                }
            });
    } catch (e) {
        console.log(e);
    }
}