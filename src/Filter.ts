import Song from "./Song";
import { STRU, trace } from "./gmusic-playlist.user";
import Converter from "./Converter";

/* a filtered list of songs*/
export default class Filter {
    songs: Song[];
    hasMatch: boolean = false;
    match: any = {};
    constructor(initialList: Song[]) {
        this.songs = initialList;
    }
    _apply(propName: keyof Song, propValue: any, exact: boolean) {
        if (!propValue) {
            return new Promise((res) => { res(this); });
        }
        var fsongs: Song[] = [];
        const looper = new ALooper(this.songs);
        return looper.forEach((song) => {
            var match = (exact) ? song[propName] === propValue : STRU.closeMatch(song[propName], propValue);
            if (match) {
                var fsong = new Converter(null).clone(song);
                fsongs.push(fsong);
                this.match[propName] = true;
            }
        }).then(() => {
            if (fsongs.length > 0) {
                this.hasMatch = true;
                this.songs = fsongs;
            }
            trace('applyed filter ' + propName + ':' + propValue, this);
            return this;
        });
    }
    removeDuplicates() {
        var unique: any = {};
        return new ALooper(this.songs).forEach((song) => {
            if (!unique[song.id])
                unique[song.id] = song;
        }).then(() => {
            this.songs = [];
            for (let key in unique) {
                this.songs.push(unique[key]);
            }
            return this;
        });
    }
    byExactSong(song) {
        return this.bySong(song, true);
    }
    bySong(song: Song, exactMatch?: boolean) {
        exactMatch = exactMatch || false;
        var keys = Object.keys(song);
        var filter = this;
        /* apply the filters one after another asyncly */
        return new Promise((resolve) => {
            var keyidx = 0;
            (function iterator() {
                if (keyidx >= keys.length) {
                    trace('filter complete for ' + song.title, filter);
                    resolve(filter);
                    return;
                }
                var key = keys[keyidx++];
                filter._apply(key, song[key], exactMatch).then(() => {
                    iterator();
                });
            })();
        });
    }
}
