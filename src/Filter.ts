import Song from "./Song";
import { trace } from "./gmusic-playlist.user";
import Converter from "./Converter";
import ALooper from "./ALooper";
import { closeMatch } from "./StringFunctions";
import Songlist from "./Songlist";

/* a filtered list of songs*/
export default class Filter {
    songs: Song[];
    hasMatch: boolean = false;
    match: {[key: string]: boolean} = {};

    constructor(initialList: Song[]) {
        this.songs = initialList;
    }

    private async apply(propName: keyof Song, propValue: any, exact: boolean) {
        // if (!propValue) {
        //     return new Promise((res) => { res(this); });
        // }

        var fsongs: Song[] = [];
        const looper = new ALooper(this.songs);

        await looper.forEach((song) => {
            return new Promise<void>(() => {
                var match = (exact) ? song[propName] === propValue : closeMatch(song[propName], propValue);
                if (match) {
                    var fsong = Converter.clone(song);
                    fsongs.push(fsong);
                    this.match[propName] = true;
                }
            });
        });
        if (fsongs.length > 0) {
            this.hasMatch = true;
            this.songs = fsongs;
        }
        trace('applyed filter ' + propName + ':' + propValue, this);
        return this;
    }

    removeDuplicates() {
        var unique: {[key: string]: Song} = {};
        var newArray: Song[] = new Array<Song>();
        
        for (let idx = 0; idx < this.songs.length; idx++) {
            var song = this.songs[idx];

            if (!unique[song.id!]) {
                unique[song.id!] = song;
                newArray.push(song);
            }
        }

        this.songs = newArray;
    }

    byExactSong(song: Song) {
        return this.bySong(song, true);
    }

    bySong(song: Song, exactMatch: boolean = false): Promise<Filter> {
        var keys: (keyof Song)[] = new Array<keyof Song>();
        for (let key in Song) {
            keys.push(key as keyof Song);
        }

        /* apply the filters one after another asyncly */
        return new Promise<Filter>((resolve) => {
            var keyidx = 0;

            var iterator = () => {
                if (keyidx >= keys.length) {
                    trace('filter complete for ' + song.title, this);
                    resolve(this);
                    return;
                }

                var key = keys[keyidx++];

                this.apply(key, song[key], exactMatch).then(() => {
                    iterator();
                });
            };
            
            iterator();
        });
    }
}
