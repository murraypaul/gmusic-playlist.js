import { trace, session, status } from "./gmusic-playlist.user";
import SessionInfo from "./SessionInfo";
import GMusic from "./GMusic";
import Converter from "./Converter";
import Filter from "./Filter";
import { pad } from "./StringFunctions";

/* a song object for holding song info. */
export default class Song {
    /* this google song id */
    id: string | null = null;
    /** if this song was suggested as a top match by google */
    _gsuggested: boolean = false;
    title: string | null = null;
    artist: string | null = null;
    album: string | null = null;
    /* track postion of song in album */
    track: number | null = null;
    /** duration of the song */
    duration: number | null = null;
    /* the google song id type 1 (free/purcahsed),
       2 (uploaded/non matched), 6 (uploaded/matched), * (other)  */
    idtype: number | null = null;
    /* the number of times this song has been played */
    playcount: number | null = null;
    /* the rating of a song, 1 (down) 5 (up) */
    rating?: number | null = null;
    /* the year this song was published */
    year?: number | null = null;
    /* the genre of the song */
    genre?: string | null = null;
    /** notes for this song, such as search info */
    notes: string = '';

    toString() {
        return JSON.stringify(this);
    }

    /* populate based on the typical gmusic array representation */
    static fromGMusic(arr: any[]) {
        var song = new Song();
        Converter.arrayToObject(arr, song, [null, 'title', null, 'artist', 'album', null, null, null, null, null,
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
    getGMusicId(sess?: SessionInfo): Promise<string> {
        if (this.id) {
            return new Promise((res) => { res(this.id!); });
        }
        sess = !sess ? session : sess;
        var music = new GMusic(sess);
        trace('looking for song id for ' + this.title, this);
        return music.search(this)!.then((filter: Filter) => {
            trace(this.title + ' search complete', [this, filter]);
            if (filter.hasMatch) {
                this.notes = pad(filter.songs.length, 2) +
                    ' results match ';
                Object.keys(filter.match).forEach((key) => {
                    this.notes += key + ':';
                });
                Converter.update(this, filter.songs[0]);
            }
            trace(this.title + ' id search complete');
            return this.id!;
        }, (err: Error) => {
            status.update('search error');
            console.log(err, this);
            throw err;
        });
    }
}
