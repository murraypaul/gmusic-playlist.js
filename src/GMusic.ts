import Song from "./Song";
import Filter from "./Filter";
import Songlist from "./Songlist";
import { debug, status } from "./gmusic-playlist.user";
import SessionInfo from "./SessionInfo";
import XDoc from "./XDoc";
import Converter from "./Converter";
import { brackets, wildWords } from "./StringFunctions";

/* send commands to google music server */
export default class GMusic {
    session: SessionInfo;

    constructor(session: SessionInfo) {
        /* the session data for communication with the server */
        this.session = session;
    }

    _req<T>(urlString: string, data: any | null, passthrough?: Songlist) {
        var session = this.session;
        return new Promise<T>((resolve, reject) => {
            var request = new XMLHttpRequest();
            request.open('POST', urlString + '?format=jsarray&' + session.getQuery());

            var onload = function () {
                var rval = passthrough ? [request.response, passthrough] : request.response;
                resolve(rval);
            };

            var balancedload = function () { setTimeout(onload, 1); };

            var onerror = function () {
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
    async searchService(search_string: string, attempts: number = 0): Promise<Songlist> {
        var gmusic = this;

        const resp = await this._req<string>('services/search', [search_string, 10, [1, 1, 1, 1, 1, 1, 1, 1, 1], 1, null, true]);
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
    }
    
    /* return a filtered list of songs based on the given song */
    search(song: Song) {
        song._gsuggested = true;
        var processes: Promise<any>[] = [];
        var songs: Song[] = [];
        var gmusic = this;

        var search_string = (song: Song) => {
            var result = !song.artist ? '' : song.artist;
            result += !song.title ? '' : ' ' + song.title;
            return result;
        };

        var bless = new Song();
        var hasBrackets = false;

        for (let key in song) {
            if (!(song as any)[key])
                return;
            var src = String((song as any)[key]);
            (bless as any)[key] = src.replace(brackets, '');
            if ((bless as any)[key] !== src) {
                hasBrackets = true;
            }
        }

        processes.push(gmusic.getLibrary().then((lib) => {
            songs = songs.concat(lib.songsByArtist(song.artist));
        }));

        processes.push(gmusic.searchService(search_string(song)).then(function (slist) { songs = songs.concat(slist.songs); }));

        if (search_string(song).match(brackets)) {
            debug('performing extra search for bracketless version ' + bless.title, bless);
            processes.push(gmusic.searchService(search_string(bless)).then(function (slist) { songs = songs.concat(slist.songs); }));
        }

        var createFilter = () => {
            return new Filter(songs);
        };

        var filterResults = (filter: Filter) => {
            return filter.bySong(song);
        };

        var filterBrackets = (filter: Filter) => {
            if (hasBrackets && !filter.match.title) {
                filter.bySong(bless);
            }

            return filter;
        };

        /* explicity titled songs sometimes have *'s in them */
        var filterWildChars = (filter: Filter) => {
            if (!filter.match.title && song.title!.match(wildWords)) {
                var tame = Converter.clone(song);
                tame.title = song.title!.replace(wildWords, '');
                filter.bySong(tame);
            }

            return filter;
        };

        /* attempt to get an exact match */
        var findExactMatch = (filter: Filter) => {
            if (!filter.match.title)
                return filter;
            return filter.byExactSong(song);
        };

        var removeDuplicates = (filter: Filter) => {
            if (filter.hasMatch) {
                filter.removeDuplicates();
            }
            return filter;
        };

        return Promise.all<Filter>(processes).then(createFilter).then(filterResults).then(filterBrackets).then(filterWildChars).then(findExactMatch).then(removeDuplicates);
    }

    /* return a songlist of all songs in the library */
    async getLibrary(): Promise<Songlist> {
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
        var getSongArray = (response: string) => {
            var songdoc = XDoc.fromString(response);
            var songarr: Song[] = [];
            var scripts = songdoc.search('//script');
            var orig_process = (window.parent as any)['slat_process'];
            
            (window.parent as any)['slat_process'] = (songdata: any) => {
                songarr = songarr.concat(songdata[0]);
            };

            scripts.forEach((script: any) => {
                try {
                    eval(script.textContent);
                    // eslint-disable-next-line no-empty
                }
                catch (err) { }
            });

            (window.parent as any)['slat_process'] = orig_process;
            return songarr;
        };

        const response = await this._req<string>('services/streamingloadalltracks', []);
        const songArray = await getSongArray(response);
        session.libraryCache = new Songlist('Library').fromGMusic(songArray);
        return session.libraryCache;
    }

    /* return a songlist of thumbs up songs */
    async getThumbsUp() {
        const resp = await this._req('services/getephemthumbsup', []);
        return new Songlist('Thumbs Up').fromGMusic(resp);
    }

    /* return an array of empty songslists */
    async getPlaylists() {
        var genSonglists = (response: string) => {
            var arr = JSON.parse(response);
            var playlistArr = arr[1][0];
            var songlists: Songlist[] = [];
            playlistArr.forEach((playlist: Songlist) => {
                songlists.push(Converter.arrayToObject(playlist, new Songlist(), ['id', 'name']));
            });
            return songlists;
        };

        const response = await this._req<string>('services/loadplaylists', []);
        return genSonglists(response);
    }

    /* return a populated songlist */
    async getPlaylistSongs(songlist: Songlist) {
        var genSonglist = (response: string) => {
            return new Songlist(songlist.name, songlist.id).fromGMusic(response);
        };
        const response = await this._req<string>('services/loaduserplaylist', [String(songlist.id)]);
        return genSonglist(response);
    }
    
    /* create gmusic playlists from the songlist */
    async createPlaylist(songlist: Songlist) {
        var gmusic = this;
        var lists = songlist.split(1000);

        var createEmptyPlaylist = (list: Songlist) => {
            status.update('creating empty ' + list.name + ' playlist');
            return gmusic._req<any[]>('services/createplaylist', [false, list.name, null, []], list);
        };

        var updateListId = (respList: any[]) => {
            var list = respList[1] as Songlist;
            var id = JSON.parse(respList[0])[1][0];
            list.id = id;
            status.update('updated ' + list.name + ' id');
            return list;
        };

        var updatePlaylist = (plist: Songlist) => {
            status.update('updated ' + plist.name + ' songs');
            return gmusic.addToPlaylist(plist);
        };

        var tasks: Promise<Songlist>[] = [];

        lists.forEach((list) => {
            tasks.push(createEmptyPlaylist(list).then(updateListId).then(updatePlaylist));
        });

        await Promise.all(tasks);
        status.update('created ' + lists.length + ' playlists');
        return lists;
    }
    
    addToPlaylist(songlist: Songlist) {
        var playlist: [string | undefined, [string, number][]] = [songlist.id, []];
        var psongs = playlist[1];
        songlist.songs.forEach(function (song) {
            if (song.id) {
                psongs.push([song.id, Number(song.idtype)]);
            }
        });
        status.update('adding tracks to ' + songlist.name);
        return this._req<Songlist>('services/addtrackstoplaylist', playlist);
    }
}
