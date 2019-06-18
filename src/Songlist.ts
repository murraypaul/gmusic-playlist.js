import GMusic from "./GMusic";
import { OptionalString, session, status, trace } from "./gmusic-playlist.user";
import SessionInfo from "./SessionInfo";
import Song from "./Song";
import { brackets } from "./StringFunctions";

/* a collection of songs. */
export default class Songlist {
    name?: string;
    songs: Song[] = [];
    id?: string;
    songsByArtistMap: { [x: string]: Song[]; } = {};

    constructor(name?: string, id?: string) {
        /* the name of the song list */
        this.name = name;
        /** the google id for this playlist */
        this.id = id;
    }

    indexSongsByArtist() {
        this.songsByArtistMap = {};
        this.songs.forEach((song) => {
            var artistKey = this.getIndexKey(song.artist);
            if (!(artistKey in this.songsByArtistMap!)) {
                this.songsByArtistMap[artistKey] = [];
            }
            this.songsByArtistMap![artistKey].push(song);
        });
    }

    getIndexKey(value: string | null) {
        if (value === null || value === '') {
            return '';
        }
        var key = value.toLowerCase();
        key = key.replace(/ and.*| &.*/, '');
        key = key.replace('the ', '');
        key = key.replace(brackets, '');
        key = key.replace(/[\W_]+/, '');
        return key;
    }

    songsByArtist(artist: OptionalString) {
        if (!artist || artist === '') {
            return [];
        }

        var artistKey = this.getIndexKey(artist);
        if (this.songsByArtistMap === null) {
            this.indexSongsByArtist();
        }
        if (artistKey in this.songsByArtistMap!) {
            return this.songsByArtistMap![artistKey];
        }
        return [];
    }

    /* split this songlist into multiple lists */
    split(splitSize: number): Songlist[] {
        var splitSonglists = [];

        for (var i = 0; i < this.songs.length; i = i + splitSize) {
            var splitlist = new Songlist(this.name + ' Part ' + (Math.floor(i / splitSize) + 1));
            splitlist.songs = this.songs.slice(i, i + splitSize);
            splitSonglists.push(splitlist);
        }

        if (splitSonglists.length < 2) {
            splitSonglists = [this];
        }

        status.update('split songlist');

        return splitSonglists;
    }
    
    /* create GMusic playlists from this songlist */
    toGMusic(sess?: SessionInfo) {
        if (this.id) {
            trace('has google id', this);
            return new Promise<Songlist[]>((res) => { res([this]); });
        }
        sess = !sess ? session : sess;
        var music = new GMusic(sess);
        status.update('creating playlist');
        return music.createPlaylist(this);
    }

    /* populate songlist from the typical gmusic response */
    fromGMusic(response: any) {
        var addsng = (sng: any, top: boolean = false) => {
            if (!sng) return;

            var song = Song.fromGMusic(sng);

            if (!song.id) return;
            song._gsuggested = top;
            this.songs.push(song);
        };

        if (response.constructor === String) {
            var arr = JSON.parse(response);
            /* google song search */
            if (arr[1][16]) {
                arr[1][16].forEach((search_type: any) => {
                    if (search_type.length > 1)
                        search_type[1].forEach((sng: any) => {
                            addsng(sng[0]);
                        });
                    /* playlist song results */
                });
            }
            else if (arr[1][0]) {
                arr[1][0].forEach((song: any) => {
                    addsng(song);
                });
            }
            /* top suggested songs */
            /* not sure where this info is anymore
            if (arr[1][3]) arr[1][3].forEach(function(sng){
                addsng(sng,true);
            });
            if (arr[1][4]) addsng(arr[1][4],true); */
        }
        else {
            response.forEach((song: any) => {
                addsng(song);
            });
        }
        
        trace('loaded ' + this.name, this);

        return this;
    }
}
