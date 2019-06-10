import { trace, session, STRU, stat } from "./gmusic-playlist.user";
import SessionInfo from "./SessionInfo";
import GMusic from "./GMusic";
import Converter from "./Converter";

/* a song object for holding song info. */
export default class Song {
    id: any;
    _gsuggested: boolean;
    title: string | null;
    artist: string | null;
    album: null;
    track: null;
    duration: null;
    idtype: null;
    playcount: null;
    rating: null;
    year: null;
    genre: null;
    notes: string;
    
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
    fromGMusic(arr: any[]) {
        var song = this;
        new Converter().arrayToObject(arr, song, [null, 'title', null, 'artist', 'album', null, null, null, null, null,
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
    getGMusicId(sess?: SessionInfo) {
        var song = this;
        if (song.id) {
            return new Promise((res) => { res(song.id); });
        }
        sess = !sess ? session : sess;
        var music = new GMusic(sess);
        trace('looking for song id for ' + song.title, song);
        return music.search(song).then(function (filter) {
            trace(song.title + ' search complete', [song, filter]);
            if (filter.hasMatch) {
                song.notes = STRU.pad(filter.songs.length, 2) +
                    ' results match ';
                Object.keys(filter.match).forEach(function (key) {
                    song.notes += key + ':';
                });
                new Converter().update(song, filter.songs[0]);
            }
            trace(song.title + ' id search complete');
            return song.id;
        }, function (err) {
            stat.update('search error');
            console.log(err, song);
        });
    }
}
