import Song from "./Song";
import Songlist from "./Songlist";

/* promise async loop traversal */
export default class ALooper {
    songs: Song[];
    chunk: number = 50;
    pause: number = 1;
    pausefunc = () => { };
    
    constructor(songs: Song[]) {
        this.songs = songs;
    }

    forEach<T>(loopCallBack: (song: Song) => Promise<T>): Promise<T[]> {
        return new Promise<T[]>((resolve) => {
            var i = 0;
            var promises: Promise<T>[] = [];

            var iterator = () => {
                if (i >= this.songs.length) {
                    Promise.all(promises).then(resolve);
                    return;
                }

                var song = this.songs[i++];
                var callbackpromise = loopCallBack(song);
                promises.push(callbackpromise);

                var pauseAndContinue = () => {
                    promises = [];
                    this.pausefunc();
                    setTimeout(iterator, this.pause);
                };

                if (i % this.chunk === 0 && i !== 0) {
                    Promise.all(promises).then(pauseAndContinue);
                }
                else {
                    iterator();
                }
            };

            iterator();
        });
    }
}
