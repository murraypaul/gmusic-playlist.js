/* eslint-disable no-console */
// ==UserScript==
// License: MIT <LICENSE>
// @author       soulfx <john.elkins@yahoo.com>
// @name         gmusic-playlist
// @namespace    https://github.com/soulfx/gmusic-playlist.js
// @version      0.170414
// @description  import and export playlists in google music
// @match        https://play.google.com/music/listen*
// @grant        none
// ==/UserScript==
/* jshint -W097 */
/* globals console, Promise */
'use strict';

var debug = function () { console.log(arguments); };
var trace = function () { console.log(arguments); };

class Status {
    constructor() {
        this.element = null;
        this.progress = '';
    }

    update(msg) {
        debug(msg);
        if (this.element) {
            setTimeout(() => {
                this.element.innerHTML = this.progress + msg;
            }, 500);
        }
    }
}

var stat = new Status();

/* string utility functions */
class StringFunctions {
    constructor() {
        this.wildWords = /\w*(\*+)\w*/g;
        this.brackets = /\[.*?\]|\(.*?\)|\{.*?\}|<.*?>/g;
        this.nonWordChars = /[\W_]+/g;
    }

    startswith(string, prefix) {
        if (!prefix || !string) return false;
        return string.slice(0, prefix.length) === prefix;
    }

    /* search in the string, return true if found, false otherwise */
    contains(string, search) {
        return String(string).indexOf(String(search)) > -1;
    }

    closeMatch(str1, str2) {
        if (!str1 || !str2) {
            return false;
        }
        var reg1 = String(str1).toLowerCase().replace(
            STRU.nonWordChars, '');
        var reg2 = String(str2).toLowerCase().replace(
            STRU.nonWordChars, '');
        if (reg1 === '' && reg2 !== '' || reg1 === '' && reg2 !== '') {
            return false;
        }
        var sizeratio = reg1.length / reg2.length;
        if ((sizeratio < 0.5 || sizeratio > 2) &&
            (!String(str1).match(STRU.brackets) || !String(str1).match(STRU.brackets))) {
            return false;
        }
        /* on the fly regex compilation is just too slow */
        //return str1.match(new RegExp(reg2s,'gi')) || str2.match(new RegExp(reg1s,'gi'));
        return this.contains(reg1, reg2) || this.contains(reg2, reg1);
    }

    /* left padd a number
    http://stackoverflow.com/a/10073788/5648123
    */
    pad(num, width, pchar) {
        pchar = pchar || '0';
        num = String(num);
        return num.length >= width ?
            num : new Array(width - num.length + 1).join(pchar) + num;
    }
}

var STRU = new StringFunctions();

/* convert between different data types */
class Converter {
    constructor(other) {
        this.csvchar = ',';
        /* object keys with this prefix will be ignored
        and treated as transient */
        this.tprefix = '_';
        var my = this;
        if (other) {
            Object.keys(other).forEach((key) => {
                my[key] = other[key];
            });
        }
    }

    quoteCsv(value) {
        if (STRU.contains(value, '"') || STRU.contains(value, this.csvchar)) {
            value = value.replace(/"/g, '""');
            value = '"' + value + '"';
        }
        return value;
    }

    unquoteCsv(value) {
        if (value.length > 0 && value[0] === '"' && value[value.length - 1] === '"') {
            value = value.substring(1, value.length - 1);
            value = value.replace(/""/g, '"');
        }
        if (value === 'null' || value === '') {
            value = null;
        }
        if (value === 'undefined') {
            value = undefined;
        }
        return value;
    }

    csvToArray(csv) {
        var arr = [];
        var val = '';
        var ignoreSep = false;
        var conv = this;
        [].slice.call(csv).forEach((char) => {
            if (char === conv.csvchar && !ignoreSep) {
                arr.push(conv.unquoteCsv(val));
                val = '';
                return;
            } else if (char === '"') {
                ignoreSep = !ignoreSep;
            }
            val += char;
        });
        arr.push(conv.unquoteCsv(val));
        return arr;
    }

    arrayToCsv(arr) {
        var csv = '';
        var conv = this;
        arr.forEach((val) => {
            csv += conv.quoteCsv(String(val)) + ',';
        });
        return csv.substring(0, csv.length - 1);
    }

    struct(obj) {
        var struct = [];
        var conv = this;
        Object.keys(obj).forEach((key) => {
            if (STRU.startswith(key, conv.tprefix)) return;
            struct.push(key);
        });
        return struct;
    }

    objectToArray(obj, structure) {
        var arr = [];
        var conv = this;
        structure = structure || conv.struct(obj);
        structure.forEach((key) => {
            arr.push(obj[key]);
        });
        return arr;
    }

    arrayToObject(arr, obj, structure) {
        var conv = this;
        structure = structure || conv.struct(obj);
        obj = !obj ? {} : obj;
        conv = this;
        structure.forEach((key, idx) => {
            if (!key) return;
            obj[key] = arr[idx];
        });
        return obj;
    }

    update(orig, update) {
        var keys = Object.keys(orig);
        keys.forEach((key) => {
            if (!orig[key] && update[key]) {
                orig[key] = update[key];
            }
        });
        return orig;
    }

    clone(src, dest) {
        dest = !dest ? new src.constructor() : dest;
        return this.arrayToObject(this.objectToArray(src), dest);
    }
}

/* handle exporting playlists */
class Exporter {
    constructor() {
    }

    listenTo(ahref) {
        ahref.addEventListener('click', () => { this.export(); }, false);
    }

    /* return a csv string for the given songlists */
    generateCsv(songlists) {
        var csv = '';
        var conv = new Converter();
        csv += conv.arrayToCsv(conv.struct(new Song())) + conv.csvchar + 'playlist\n';
        songlists.forEach((songlist) => {
            songlist.songs.forEach((song) => {
                csv += conv.arrayToCsv(conv.objectToArray(song)) +
                    conv.csvchar + conv.quoteCsv(songlist.name) + '\n';
            });
        });
        stat.update('generated csv for ' + songlists.length + ' playlists');
        return csv;
    }

    /* trigger a download file for the given csv text */
    downloadCsv(csv, filename) {
        /* use blob to overcome href data limits */
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var doc = new XDoc(document);
        doc.create('a', null, {
            'href': url, 'download': filename
        }).click();
        /* TODO may need to call revokeOjectURL to clean up mem */
    }

    export() {
        var ex = this;
        var music = new GMusic(session);

        var populateSonglists = (songlists) => {
            var lists = [];
            var populated = [];
            var addpop = (full) => {
                populated.push(full);
            };
            songlists.forEach((songlist) => {
                lists.push(music.getPlaylistSongs(songlist).then(addpop));
            });
            lists.push(music.getThumbsUp().then(addpop));
            lists.push(music.getLibrary().then(addpop));
            stat.update('queued up ' + lists.length + ' playlists for download');
            return Promise.all(lists).then(() => {
                var totalSongs = 0;
                populated.forEach((plist) => {
                    totalSongs += plist.songs.length;
                });
                stat.progress = totalSongs + ' songs. ';
                stat.update('obtained ' + populated.length + ' playlists');
                return populated;
            });
        };

        music.getPlaylists().then(populateSonglists).then((songlists) => {
            ex.downloadCsv(ex.generateCsv(songlists), 'playlists_export.csv');
        });
    }
}

/* handle importing playlists */
class Importer {
    constructor() { }

    onload(event) {
        console.log('file load complete');
        console.log(event.target.result);
    }

    listenTo(value) {
        var file = this;
        value.addEventListener('change', (e) => { file.read.call(file, e); }, false);
    }

    readFile(file) {
        stat.update('preparing to read file');
        return new Promise((resolve, reject) => {
            var reader = new FileReader();
            var onload = (event) => { resolve(event.target.result); };
            var onerror = () => { reject(Error('file error')); };
            reader.addEventListener('load', onload, false);
            reader.addEventListener('error', onerror, false);
            reader.readAsText(file);
        });
    }

    /* read the select file from an input file element */
    read(input) {
        var file = input.target.files[0];

        const isHeader = (harr) => {
            stat.update('checking for header');
            return harr.indexOf('title') > -1;
        };

        const getStructures = (harr) => {
            var pstruct = [];
            var sstruct = [];

            harr.forEach((header) => {
                if (header.trim() === 'playlist') {
                    pstruct.push('name');
                    sstruct.push(null);
                } else {
                    pstruct.push(null);
                    sstruct.push(header);
                }
            });

            var hstructs = { 'playlist': pstruct, 'song': sstruct };
            stat.update('returning header structures');
            return hstructs;
        };

        if (!file) {
            stat.update('file is not valid');
            return;
        }

        /* parse the csv file and return an array of songlists */
        const parseCsv = (csv) => {
            var conv = new Converter();
            var songlistmap = {};
            var lines = csv.split('\n');
            var sstruct = conv.struct(new Song());
            var pstruct = conv.struct(new Song());
            pstruct.push('playlist');
            pstruct = getStructures(pstruct).playlist;
            lines.forEach((line, i) => {
                line = line.replace(/\r/g, '');
                if (line === '') return;
                var arr = conv.csvToArray(line);
                if (i === 0 && isHeader(arr)) {
                    var structs = getStructures(arr);
                    sstruct = structs.song;
                    pstruct = structs.playlist;
                    return;
                }
                var songlist = conv.arrayToObject(
                    arr, new Songlist(), pstruct);
                if (!songlist.name) {
                    songlist.name = new Date().toString(
                    ).split(' ').splice(0, 4).join(' ');
                }
                if (!songlistmap[songlist.name]) {
                    songlistmap[songlist.name] = songlist;
                }
                songlistmap[songlist.name].songs.push(
                    conv.arrayToObject(arr, new Song(), sstruct));
            });
            var songlists = [];
            var songlistnames = Object.keys(songlistmap);
            songlistnames.forEach((name) => {
                songlists.push(songlistmap[name]);
            });
            stat.update('parsed ' + songlists.length + ' playlists');
            return songlists;
        };

        /* search for gmusic song ids for the songs in each song list */
        var getGMusicSongIds = (songlists) => {
            var songcount = 0;
            var allsongs = [];
            var progress = () => { return songcount + '/' + allsongs.length + ' songs. '; };
            songlists.forEach((songlist) => {
                allsongs = allsongs.concat(songlist.songs);
            });
            stat.progress = progress();
            stat.update('searching...');
            var searchCompleted = () => {
                stat.update('song search complete for ' +
                    songlists.length + ' playlists');
                return songlists;
            };
            var searchFailed = (err) => {
                stat.update('search error');
                console.log(err);
            };
            var looper = new ALooper(allsongs);
            return looper.forEach((song) => {
                return song.getGMusicId().then(() => {
                    if (song.id) {
                        ++songcount;
                        stat.update('found: ' + song.title + ' by ' + song.artist);
                    }
                    stat.progress = progress();
                });
            }).then(searchCompleted, searchFailed);
        };
        /* create playlists for the songlists */
        var createGMusicPlaylists = (songlists) => {
            var createTasks = [];
            var createdlists = [];
            songlists.forEach((songlist) => {
                createTasks.push(songlist.toGMusic().then(
                    (gmusiclists) => {
                        createdlists = createdlists.concat(gmusiclists);
                    }));
            });
            stat.update('creating ' + createTasks.length + ' playlists');
            return Promise.all(createTasks).then(() => {
                stat.update('created ' + createdlists.length + ' playlists');
                return createdlists;
            });
        };
        /* convert the songlists back to csv and provide for download */
        var exporter = new Exporter();
        this.readFile(file).then(parseCsv).then(getGMusicSongIds)
            .then(createGMusicPlaylists).then((gmusiclists) => {
                exporter.downloadCsv(exporter.generateCsv(gmusiclists), 'playlists_import.csv');
            });
    }
}

/* XML document functions */
class XDoc {
    constructor(document) {
        this.doc = document;
    }

    /* create a new element for the doc */
    create(tagName, tagValue, attributes) {
        var el = this.doc.createElement(tagName);
        if (typeof tagValue === 'string') {
            el.appendChild(this.doc.createTextNode(tagValue));
        } else if (tagValue && tagValue.constructor === Array) {
            for (var i = 0; i < tagValue.length; i++) {
                el.appendChild(tagValue[i]);
            }
        } else if (tagValue) {
            el.appendChild(tagValue);
        }
        if (attributes) {
            for (var key in attributes) {
                el.setAttribute(key, attributes[key]);
            }
        }
        return el;
    }

    /* get a list of elements matching the xpath */
    search(xpath) {
        var results = [];
        var xpathresults = document.evaluate(
            xpath, this.doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);
        for (var i = 0; i < xpathresults.snapshotLength; i++) {
            results.push(xpathresults.snapshotItem(i));
        }
        debug('searching for xpath' + xpath);
        return results;
    }

    /* create a XDoc from a string (text/html by default) */
    fromString(string, type) {
        if (!type) {
            type = 'text/html';
        }
        var parser = new DOMParser();
        this.doc = parser.parseFromString(string, type);
        return this;
    }
}

/* promise async loop traversal */
class ALooper {
    constructor(arr) {
        this.arr = arr;
        this.chunk = 50;
        this.pause = 1;
        this.pausefunc = () => { };
    }

    forEach(loopCallBack) {
        var looper = this;

        return new Promise((resolve) => {
            var i = 0;
            var promises = [];

            var iterator = () => {
                if (i >= looper.arr.length) {
                    Promise.all(promises).then(resolve);
                    return;
                }

                var arrval = looper.arr[i++];
                var callbackpromise = loopCallBack(arrval, i, looper.arr);
                promises.push(callbackpromise);

                var pauseAndContinue = () => {
                    promises = [];
                    looper.pausefunc();
                    setTimeout(iterator, looper.pause);
                };

                if (i % looper.chunk === 0 && i !== 0) {
                    Promise.all(promises).then(pauseAndContinue);
                } else {
                    iterator();
                }
            };

            iterator();
        });
    }
}

/* a filtered list of songs*/
class Filter {
    constructor(initialList) {
        this.songs = initialList;
        this.hasMatch = false;
        /* key is a property,
        value is true or false if the property had a match */
        this.match = {};
    }

    _apply(propName, propValue, exact) {
        var filter = this;

        if (!propValue) {
            return new Promise((res) => { res(filter); });
        }

        var fsongs = [];
        
        return new ALooper(filter.songs).forEach((song) => {
            var match = (exact) ? song[propName] === propValue : STRU.closeMatch(song[propName], propValue);
            if (match) {
                var fsong = new Converter({ 'tprefix': null }).clone(song);
                fsongs.push(fsong);
                filter.match[propName] = true;
            }
        }).then(() => {
            if (fsongs.length > 0) {
                filter.hasMatch = true;
                filter.songs = fsongs;
            }
            trace('applyed filter ' + propName + ':' + propValue, filter);
            return filter;
        });
    }

    removeDuplicates() {
        var filter = this;
        var unique = {};
        return new ALooper(filter.songs).forEach((song) => {
            if (!unique[song.id]) unique[song.id] = song;
        }).then(() => {
            filter.songs = [];
            Object.keys(unique).forEach((key) => {
                filter.songs.push(unique[key]);
            });
            return filter;
        });
    }

    byExactSong(song) {
        return this.bySong(song, true);
    }

    bySong(song, exactMatch) {
        exactMatch = exactMatch || false;
        var keys = Object.keys(song);
        var filter = this;
        /* apply the filters one after another asyncly */
        return new Promise((resolve) => {
            var keyidx = 0;
            (function iterator() {
                if (keyidx >= keys.length) {
                    trace('filter complete for ' + song.title, filter);
                    resolve(filter); return;
                }
                var key = keys[keyidx++];
                filter._apply(key, song[key], exactMatch).then(() => {
                    iterator();
                });
            })();
        });
    }
}

/* a collection of songs. */
class Songlist {
    constructor(name, id) {
        /* the name of the song list */
        this.name = name;
        /* the songs in the song list */
        this.songs = [];
        /** the google id for this playlist */
        this.id = id;
        this.songsByArtistMap = null;
    }

    indexSongsByArtist() {
        var slist = this;
        slist.songsByArtistMap = {};
        slist.songs.forEach((song) => {
            var artistKey = slist.getIndexKey(song.artist);
            if (!(artistKey in slist.songsByArtistMap)) {
                slist.songsByArtistMap[artistKey] = [];
            }
            slist.songsByArtistMap[artistKey].push(song);
        });
    }

    getIndexKey(value) {
        if (value === null || value === '') {
            return '';
        }
        var key = value.toLowerCase();
        key = key.replace(/ and.*| &.*/, '');
        key = key.replace('the ', '');
        key = key.replace(STRU.brackets, '');
        key = key.replace(/[\W_]+/, '');
        return key;
    }

    songsByArtist(artist) {
        if (!artist || artist === '') {
            return [];
        }
        var slist = this;
        var artistKey = slist.getIndexKey(artist);
        if (slist.songsByArtistMap === null) {
            slist.indexSongsByArtist();
        }
        if (artistKey in slist.songsByArtistMap) {
            return slist.songsByArtistMap[artistKey];
        }
        return [];
    }

    /* split this songlist into multiple lists */
    split(splitSize) {
        var songlist = this;
        var splitSonglists = [];
        for (var i = 0; i < songlist.songs.length; i = i + splitSize) {
            var splitlist = new Songlist(songlist.name + ' Part ' +
                (Math.floor(i / splitSize) + 1));
            splitlist.songs = songlist.songs.slice(i, i + splitSize);
            splitSonglists.push(splitlist);
        }
        if (splitSonglists.length < 2) {
            splitSonglists = [songlist];
        }
        stat.update('split songlist');
        return splitSonglists;
    }

    /* create GMusic playlists from this songlist */
    toGMusic(sess) {
        var songlist = this;
        if (songlist.id) {
            trace('has google id', songlist);
            return new Promise((res) => { res([songlist]); });
        }
        sess = !sess ? session : sess;
        var music = new GMusic(sess);
        stat.update('creating playlist');
        return music.createPlaylist(songlist);
    }

    /* populate songlist from the typical gmusic response */
    fromGMusic(response) {
        var songlist = this;
        var addsng = (sng, top) => {
            if (!sng) return;
            top = top || false;
            var song = new Song().fromGMusic(sng);
            if (!song.id) return;
            song._gsuggested = top;
            songlist.songs.push(song);
        };
        if (response.constructor === String) {
            var arr = JSON.parse(response);
            /* google song search */
            if (arr[1][16]) {
                arr[1][16].forEach((search_type) => {
                    if (search_type.length > 1) search_type[1].forEach((sng) => {
                        addsng(sng[0]);
                    });
                    /* playlist song results */
                });
            } else if (arr[1][0]) {
                arr[1][0].forEach((song) => {
                    addsng(song);
                });
            }
            /* top suggested songs */
            /* not sure where this info is anymore
            if (arr[1][3]) arr[1][3].forEach(function(sng){
                addsng(sng,true);
            });
            if (arr[1][4]) addsng(arr[1][4],true); */
        } else {
            response.forEach((song) => {
                addsng(song);
            });
        }
        trace('loaded ' + this.name, this);
        return this;
    }
}

/* a song object for holding song info. */
class Song {
    constructor() {
        this.title = null;
        this.artist = null;
        this.album = null;
        /* track postion of song in album */
        this.track = null;
        /** duration of the song */
        this.duration = null;
        /* this google song id */
        this.id = null;
        /* the google song id type 1 (free/purcahsed),
           2 (uploaded/non matched), 6 (uploaded/matched), * (other)  */
        this.idtype = null;
        /* the number of times this song has been played */
        this.playcount = null;
        /* the rating of a song, 1 (down) 5 (up) */
        this.rating = null;
        /* the year this song was published */
        this.year = null;
        /* the genre of the song */
        this.genre = null;
        /** notes for this song, such as search info */
        this.notes = '';
        /** if this song was suggested as a top match by google */
        this._gsuggested = false;
    }

    toString() {
        return JSON.stringify(this);
    }

    /* populate based on the typical gmusic array representation */
    fromGMusic(arr) {
        var song = this;
        new Converter().arrayToObject(
            arr, song, [null, 'title', null, 'artist', 'album', null, null, null, null, null,
                null, 'genre', null, 'duration', 'track', null, null, null, 'year', null,
                null, null, 'playcount', 'rating', null, null, null, null, 'id', 'idtype']);
        /* use the unique ID for non all access (personal) songs */
        if (!song.id || song.idtype === 2 || song.idtype === 6 || song.idtype === 1) {
            song.id = arr[0];
        }
        trace('loaded song ' + song.title, [song, arr]);
        return song;
    }

    /* return the id if not null, otherwise search GMusic for the id,
       if search fails to find a result null will be returned. */
    getGMusicId(sess) {
        var song = this;
        if (song.id) {
            return new Promise((res) => { res(song.id); });
        }
        sess = !sess ? session : sess;
        var music = new GMusic(sess);
        trace('looking for song id for ' + song.title, song);
        return music.search(song).then((filter) => {
            trace(song.title + ' search complete', [song, filter]);
            if (filter.hasMatch) {
                song.notes = STRU.pad(filter.songs.length, 2) +
                    ' results match ';
                Object.keys(filter.match).forEach((key) => {
                    song.notes += key + ':';
                });
                new Converter().update(song, filter.songs[0]);
            }
            trace(song.title + ' id search complete');
            return song.id;
        }, (err) => {
            stat.update('search error');
            console.log(err, song);
        });
    }
}

/* send commands to google music server */
class GMusic {
    constructor(session) {
        /* the session data for communication with the server */
        this.session = session;
    }

    _req(urlString, data, passthrough) {
        var session = this.session;
        return new Promise((resolve, reject) => {
            var request = new XMLHttpRequest();
            request.open('POST', urlString + '?format=jsarray&' + session.getQuery());
            var onload = () => {
                var rval = passthrough ? [request.response, passthrough] : request.response;
                resolve(rval);
            };
            var balancedload = () => { setTimeout(onload, 1); };
            var onerror = () => {
                reject(Error('network error'));
            };
            request.addEventListener('load', balancedload, false);
            request.addEventListener('error', onerror, false);
            var postData = session.getPostArray();
            postData[1] = data;
            request.send(JSON.stringify(postData));
        });
    }

    /* return a songlist of songs from the service based on search_string */
    searchService(search_string, attempts) {
        attempts = (attempts) ? attempts : 0;
        var gmusic = this;
        return this._req('services/search', [search_string, 10, [1, 1, 1, 1, 1, 1, 1, 1, 1], 1, null, true]).then((resp) => {
            var resultlist = new Songlist(search_string + ' search results').fromGMusic(resp);
            if (!resultlist.songs.length) {
                var suggestion = JSON.parse(resp)[1][10];
                if (suggestion && attempts < 3) {
                    debug('retrying search using suggestion ' + suggestion, [resp]);
                    attempts = attempts + 1;
                    return gmusic.searchService(suggestion, attempts);
                }
            }
            debug('recieved search response for ' + search_string, [resp, resultlist]);
            return resultlist;
        });
    }

    /* return a filtered list of songs based on the given song */
    search(song) {
        song._gsuggested = true;
        var processes = [];
        var songs = [];
        var gmusic = this;
        var search_string = (song) => {
            var string = !song.artist ? '' : song.artist;
            string += !song.title ? '' : ' ' + song.title;
            return string;
        };
        var bless = new Song();
        var hasBrackets = false;
        Object.keys(song).forEach((key) => {
            if (!song[key]) return;
            var src = String(song[key]);
            bless[key] = src.replace(STRU.brackets, '');
            if (bless[key] !== src) {
                hasBrackets = true;
            }
        });
        processes.push(gmusic.getLibrary().then((lib) => {
            songs = songs.concat(lib.songsByArtist(song.artist));
        }));
        processes.push(gmusic.searchService(search_string(song)).then(
            (slist) => { songs = songs.concat(slist.songs); }));
        if (search_string(song).match(STRU.brackets)) {
            debug('performing extra search for bracketless version ' + bless.title, bless);
            processes.push(gmusic.searchService(search_string(bless)).then(
                (slist) => { songs = songs.concat(slist.songs); }));
        }
        var createFilter = () => {
            return new Filter(songs);
        };
        var filterResults = (filter) => {
            return filter.bySong(song);
        };
        var filterBrackets = (filter) => {
            if (hasBrackets && !filter.match.title) {
                filter.bySong(bless);
            }
            return filter;
        };
        /* explicity titled songs sometimes have *'s in them */
        var filterWildChars = (filter) => {
            if (!filter.match.title && song.title.match(STRU.wildWords)) {
                var tame = new Converter({ 'tprefix': null }).clone(song);
                tame.title = song.title.replace(STRU.wildWords, '');
                filter.bySong(tame);
            }
            return filter;
        };
        /* attempt to get an exact match */
        var findExactMatch = (filter) => {
            if (!filter.match.title) return filter;
            return filter.byExactSong(song);
        };
        var removeDuplicates = (filter) => {
            if (filter.hasMatch) {
                filter.removeDuplicates();
            }
            return filter;
        };
        return Promise.all(processes).then(createFilter).then(
            filterResults).then(
            filterBrackets).then(
            filterWildChars).then(
            findExactMatch).then(
            removeDuplicates);
    }

    /* return a songlist of all songs in the library */
    getLibrary() {
        var gmusic = this;
        var session = gmusic.session;
        if (session.libraryCache) {
            return new Promise((resolve) => {
                resolve(session.libraryCache);
            });
        }
        /* ...loadalltracks returns an html document
           where the library is split between multiple script
           segments
         */
        var getSongArray = (response) => {
            var songdoc = new XDoc().fromString(response);
            var songarr = [];
            var scripts = songdoc.search('//script');
            var orig_process = window.parent.slat_process;
            window.parent.slat_process = (songdata) => {
                songarr = songarr.concat(songdata[0]);
            };
            scripts.forEach((script) => {
                try {
                    eval(script.textContent);
                    // eslint-disable-next-line no-empty
                } catch (err) { }
            });
            window.parent.slat_process = orig_process;
            return songarr;
        };
        return this._req('services/streamingloadalltracks', []).then(
            getSongArray).then((songArray) => {
            session.libraryCache = new Songlist('Library').fromGMusic(songArray);
            return session.libraryCache;
        });
    }

    /* return a songlist of thumbs up songs */
    getThumbsUp() {
        return this._req('services/getephemthumbsup', []).then((resp) => {
            return new Songlist('Thumbs Up').fromGMusic(resp);
        });
    }

    /* return an array of empty songslists */
    getPlaylists() {
        var genSonglists = (response) => {
            var arr = JSON.parse(response);
            var playlistArr = arr[1][0];
            var songlists = [];
            playlistArr.forEach((playlist) => {
                songlists.push(new Converter().arrayToObject(
                    playlist, new Songlist(), ['id', 'name']));
            });
            return songlists;
        };

        return this._req('services/loadplaylists', []).then(genSonglists);
    }

    /* return a populated songlist */
    getPlaylistSongs(songlist) {
        var genSonglist = (response) => {
            return new Songlist(songlist.name, songlist.id).fromGMusic(response);
        };

        return this._req('services/loaduserplaylist', [String(songlist.id)]).then(genSonglist);
    }

    /* create gmusic playlists from the songlist */
    createPlaylist(songlist) {
        var gmusic = this;
        var lists = songlist.split(1000);

        var createEmptyPlaylist = (list) => {
            stat.update('creating empty ' + list.name + ' playlist');
            return gmusic._req('services/createplaylist', [false, list.name, null, []], list);
        };

        var updateListId = (respList) => {
            var list = respList[1];
            var id = JSON.parse(respList[0])[1][0];
            list.id = id;
            stat.update('updated ' + list.name + ' id');
            return list;
        };
        var updatePlaylist = (plist) => {
            stat.update('updated ' + plist.name + ' songs');
            return gmusic.addToPlaylist(plist);
        };

        var tasks = [];
        lists.forEach((list) => {
            tasks.push(createEmptyPlaylist(list).then(
                updateListId).then(updatePlaylist));
        });
        return Promise.all(tasks).then(() => {
            stat.update('created ' + lists.length + ' playlists');
            return lists;
        });
    }

    addToPlaylist(songlist) {
        var playlist = [songlist.id, []];
        var psongs = playlist[1];
        songlist.songs.forEach((song) => {
            if (song.id) {
                psongs.push([song.id, Number(song.idtype)]);
            }
        });
        stat.update('adding tracks to ' + songlist.name);
        return this._req('services/addtrackstoplaylist', playlist);
    }
}


/* session information needed in order to send reqs to server */
class SessionInfo {
    constructor() {
        /* the library cache */
        this.libraryCache = null;
        /* the dv value */
        this.dv = null;
        /* the xt code, not sure exactly what this is yet */
        this.xtcode = null;
        /* the session id, is sent in posts */
        this.sessionid = null;
        /* the obfid, not sure what this is yet. */
        this.obfid = null;
        /* listener for when the session first becomes valid. */
        this.oninit = () => {
            new GMusic(this).getLibrary().then((songlist) => {
                console.log('session active. ' + songlist.songs.length + ' songs loaded. ');
            });
        };
    }

    isValid() {
        return this.xtcode && this.sessionid && this.obfid;
    }

    getQuery() {
        return 'u=0&xt=' + this.xtcode + '&dv=' + this.dv + '&obfid=' + this.obfid;
    }

    getPostArray() {
        return [[this.sessionid, 1], null];
    }

    /* populate session info from an xhr tap */
    fromTap(tap) {
        if (this.isValid()) {
            return;
        }
        var qps = tap.getQueryParams();
        if ('xt' in qps && 'obfid' in qps && 'dv' in qps) {
            this.xtcode = qps.xt;
            this.obfid = qps.obfid;
            this.dv = qps.dv;
        }
        if (tap.method.toLowerCase() == 'post') {
            try {
                this.sessionid = JSON.parse(tap.data)[0][0];
                // eslint-disable-next-line no-empty
            } catch (err) { }
        }
        if (this.isValid()) {
            if (this.oninit) {
                this.oninit(this);
                this.oninit = null;
            }
        }
    }
}

/* an ajax tap to be able to peek into client/server comms */
class XHRTap {
    constructor() {
        this.method = null;
        this.url = null;
        this.data = null;
        this.sendcallback = function () {
            console.log(this.method);
            console.log(this.url);
            console.log(this.data);
        };
        this.loadcallback = null;
        this._origOpen = XMLHttpRequest.prototype.open;
        this._origSend = XMLHttpRequest.prototype.send;
    }

    /* credits to: http://stackoverflow.com/questions/3596583/javascript-detect-an-ajax-event */
    inject() {
        var tap = this;
        XMLHttpRequest.prototype.open = function (a, b) {
            if (!a) a = '';
            if (!b) b = '';
            tap._origOpen.apply(this, arguments);
            tap.method = a;
            tap.url = b;
            if (a.toLowerCase() == 'get') {
                tap.data = b.split('?');
                tap.data = tap.data[1];
            }
        };
        XMLHttpRequest.prototype.send = function (a, b) {
            if (!a) a = '';
            if (!b) b = '';
            tap._origSend.apply(this, arguments);
            if (tap.method.toLowerCase() == 'post') tap.data = a;
            if (tap.sendcallback) {
                tap.sendcallback(this);
            }
            if (tap.loadcallback) {
                this.addEventListener('load', tap.loadcallback, false);
            }
        };
    }

    getQuery() {
        return this.url.split('?')[1];
    }

    getQueryParams() {
        var params = {};
        if (!this.getQuery()) {
            return params;
        }
        var keyVals = this.getQuery().split('&');
        for (var i = 0; i < keyVals.length; i++) {
            var keyVal = keyVals[i].split('=');
            params[keyVal[0]] = keyVal[1];
        }
        return params;
    }
}

/* wait for the UI to fully load and then insert the import/export controls */
var addui = function () {
    var ui = new XDoc(document);

    var menu = ui.search('//div[@class="nav-section-divider"]')[0];
    var inputui = ui.create('input', false, { 'type': 'file' });
    var importui = ui.create('div', [ui.create('h4', 'Import Playlists'), inputui]);

    var exportlink = ui.create('a', 'Export Playlists', { 'href': '#exportCSV' });
    var exportui = ui.create('div', ui.create('h4', exportlink));
    var statusout = ui.create('h6', 'ready');
    var statusui = ui.create('div', [statusout]);

    stat.element = statusout;

    var exporter = new Exporter();
    exporter.listenTo(exportlink);

    var importer = new Importer();
    importer.listenTo(inputui);

    if (menu) {
        menu.appendChild(importui);
        menu.appendChild(exportui);
        menu.appendChild(statusui);
    } else {
        console.log('unable to locate menu element');
    }
};

window.addEventListener('load', addui, false);

var session = new SessionInfo();

var tap = new XHRTap();

/* pull out session information from the clinet/server comms */
tap.sendcallback = () => session.fromTap(tap);
tap.inject();
