process.on('uncaughtException', function(err) {
	console.log(err);
	console.log(lr);
});

var fs = require('fs');
var LineByLineReader = require('line-by-line');
var fetchUrl = require("fetch").fetchUrl;
var cheerio = require('cheerio');
var dns = require('dns');

var args = require('commander');

args
	.version('1.0.0')
	.description('required parameters are marked by *')
	.option('-u, --urls <path>', '* path to file which contains urls')
	.option('-r, --result <path>', '* path to file to put results')
	.parse(process.argv);

if ( ! args.result || ! args.urls) {
	console.log('you need to specify all required arguments');
	return;
};

var domainsFile = fs.createWriteStream(args.result);

var Bm = function(){
	this.start = (new Date()).getTime();
	return this;
};
Bm.prototype.getTime = function() {
	return Math.abs( ( this.start - (new Date()).getTime() ) / 1000 );
};

var domains = [];

var reHttp = /^http(s?)\:\/\//i;
var reStartingOfATag = /(?:\<a\ )(?:[^\>]*)(?:\>)/gim;
var reExtractHref = /href\=(?:'|")([^'|"]+)/i;

function domainNameFromUrl(url) {
	if (reHttp.test(url)) {
		var domain = url.replace(reHttp, '').split(/\?|\/|\:/)[0];
		if (domains.indexOf(domain) == -1) {
			domains.push(domain);
			// console.log('doamin: ' + domain);
			return domain;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

var bm = new Bm();
var lr = new LineByLineReader(args.urls);
var fetching = 0;

function lookupHendler(err, addresses, family) {
	if (err) {
		domainsFile.write(err.hostname+'\n');
	};
}

function fetchHrefValue(elem){
	var result;
	if (result = elem.match(reExtractHref)) {
		return result[1];
	} else {
		return '';
	}
}

function forEachLink(elem){
	var href;
	if (href = fetchHrefValue(elem)) {
		if (domain = domainNameFromUrl(href)) {
			dns.lookup(domain, lookupHendler);
		};
	};
}

function fetchHendler(err, meta, body){
	fetching--;
	if ( lr._paused && fetching < 70000) {
		lr.resume();
		console.log('stream resume!');
	};

	if ( ! err) {
		var links;
		if (links = body.toString().match(reStartingOfATag)) {
			links.forEach(forEachLink);
		};
	};
}

var fetchOptions = {
	timeout: 10000,
	headers: {
		Accept: "text/html"
	}
};
function lineHendler(line) {
	if (line[0] == 'h') {
		// console.log('fetch: ' + line);
		fetching++;
		if (fetching > 80000) {
			lr.pause();
			console.log('stream paused!');
		}
		fetchUrl(line, fetchOptions, fetchHendler);
	};
}
function endHendler() {
	console.log('end');
	var secs = bm.getTime();
	console.log(secs+" seconds");
}
function errorHendler(err) {
	console.log(err);
}

lr.on('error', errorHendler);
lr.on('line', lineHendler);
lr.on('end', endHendler);


process.on('SIGINT', function() {
	var secs = bm.getTime();
	console.log(secs+" seconds");
	process.exit();
});

