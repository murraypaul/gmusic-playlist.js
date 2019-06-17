import { status, OptionalString } from "./gmusic-playlist.user";
import Song from "./Song";
import Songlist from "./Songlist";
import Converter from "./Converter";
import ALooper from "./ALooper";
import Exporter from "./Exporter";

/* handle importing playlists */
export default class Importer {
    // onload(event) {
    //     console.log('file load complete');
    //     console.log(event.target.result);
    // }
    listenTo(value: HTMLInputElement) {
        value.addEventListener('change', () => this.read(value), false);
    }

    readFile(file: Blob) {
        status.update('preparing to read file');
        return new Promise<any>((resolve, reject) => {
            var reader = new FileReader();
            var onload = (event: any) => resolve(event.target.result);

            var onerror = () => reject(Error('file error'));
            reader.addEventListener('load', onload, false);
            reader.addEventListener('error', onerror, false);
            reader.readAsText(file);
        });
    }

    /* read the select file from an input file element */
    read(input: HTMLInputElement) {
        var file: File = input.files![0];

        const isHeader = (harr: OptionalString[]) => {
            status.update('checking for header');
            return harr.indexOf('title') > -1;
        };

        const getStructures = <T = (Song | Songlist)>(harr: (keyof T | null)[]) => {
            var pstruct: (keyof Songlist | null)[] = [];
            var sstruct: (keyof Song | null)[] = [];

            harr.forEach((header) => {
                if (header && header === 'name' && header.valueOf() == typeof Songlist) {
                    pstruct.push('name');
                    sstruct.push(null);
                } else if (header && header.valueOf() == typeof Song) {
                    pstruct.push(null);
                    sstruct.push(header as keyof Song);
                }
            });

            status.update('returning header structures');

            return {
                playlist: pstruct,
                song: sstruct
            };
        };

        if (!file) {
            status.update('file is not valid');
            return;
        }

        /* parse the csv file and return an array of songlists */
        const parseCsv = (csv: string) => {
            var songlistmap: { [i: string]: Songlist } = {};
            var lines = csv.split('\n');
            var sstruct: (keyof Song | null)[] = Converter.struct(new Song());
            var pstruct: (keyof Songlist | null)[] = Converter.struct(new Songlist());

            pstruct.push('name');
            pstruct = getStructures(pstruct).playlist;

            lines.forEach((line, i) => {
                line = line.replace(/\r/g, '');

                if (line === '') return;

                var arr = Converter.csvToArray(line) as (keyof Songlist)[];

                if (i === 0 && isHeader(arr!)) {
                    var structs = getStructures(arr!);
                    sstruct = structs.song;
                    pstruct = structs.playlist;
                    return;
                }

                var songlist: Songlist = Converter.arrayToObject(arr, new Songlist(), pstruct);
                if (!songlist.name) {
                    songlist.name = new Date().toString().split(' ').splice(0, 4).join(' ');
                }
                if (!songlistmap[songlist.name]) {
                    songlistmap[songlist.name] = songlist;
                }
                songlistmap[songlist.name].songs.push(Converter.arrayToObject(arr, new Song(), sstruct));
            });
            var songlists: Songlist[] = [];
            var songlistnames = Object.keys(songlistmap);
            songlistnames.forEach((name) => {
                songlists.push(songlistmap[name]);
            });
            status.update('parsed ' + songlists.length + ' playlists');
            return songlists;
        };

        /* search for gmusic song ids for the songs in each song list */
        var getGMusicSongIds = (songlists: Songlist[]): Promise<Songlist[]> => {
            var songcount = 0;
            var allsongs: Song[] = [];
            var progress = () => { return songcount + '/' + allsongs.length + ' songs. '; };

            songlists.forEach((songlist) => {
                allsongs = allsongs.concat(songlist.songs);
            });

            status.progress = progress();
            status.update('searching...');

            var searchCompleted = () => {
                status.update('song search complete for ' + songlists.length + ' playlists');
                return songlists;
            };

            var searchFailed = (err: Error) => {
                status.update('search error');
                console.log(err);
                throw err;
            };

            var looper = new ALooper(allsongs);
            
            return looper.forEach((song) => {
                return song.getGMusicId().then(() => {
                    if (song.id) {
                        ++songcount;
                        status.update('found: ' + song.title + ' by ' + song.artist);
                    }
                    status.progress = progress();
                });
            }).then(searchCompleted, searchFailed);
        };

        /* create playlists for the songlists */
        var createGMusicPlaylists = (songlists: Songlist[]) => {
            var createTasks: Promise<any>[] = [];
            var createdlists: Songlist[] = [];
            songlists.forEach((songlist) => {
                createTasks.push(songlist.toGMusic().then((gmusiclists) => {
                    createdlists = createdlists.concat(gmusiclists);
                }));
            });
            status.update('creating ' + createTasks.length + ' playlists');
            return Promise.all(createTasks).then(() => {
                status.update('created ' + createdlists.length + ' playlists');
                return createdlists;
            });
        };

        /* convert the songlists back to csv and provide for download */
        var exporter = new Exporter();

        this.readFile(file).then(parseCsv).then(getGMusicSongIds)
            .then(createGMusicPlaylists).then((gmusiclists: Songlist[]) => {
                exporter.downloadCsv(exporter.generateCsv(gmusiclists), 'playlists_import.csv');
            });
    }
}
