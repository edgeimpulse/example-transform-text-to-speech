// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleAuth, grpc } = require('google-gax');

// Import other required libraries
const fs = require('fs');
const util = require('util');
const Path = require('path');
const { execSync } = require('child_process');
const program = require('commander');
const os = require('os');
const { spawnSync } = require('child_process');

if (!process.env.GOOGLE_CLOUD_TTS_API_KEY) {
    console.log('Missing GOOGLE_CLOUD_TTS_API_KEY');
    process.exit(1);
}

if (!process.env.EI_PROJECT_ID) {
    console.log('Missing EI_PROJECT_ID');
    process.exit(1);
}

if (!process.env.EI_PROJECT_API_KEY) {
    console.log('Missing EI_PROJECT_API_KEY');
    process.exit(1);
}

if (!process.env.EI_API_ENDPOINT) {
    console.log('Missing EI_API_ENDPOINT');
    process.exit(1);
}

if (!process.env.EI_INGESTION_HOST) {
    console.log('Missing EI_INGESTION_HOST');
    process.exit(1);
}

const PROJECT_ID = Number(process.env.EI_PROJECT_ID);
let API_URL = process.env.EI_API_ENDPOINT;
const API_KEY = process.env.EI_PROJECT_API_KEY;

API_URL = API_URL.replace('/v1', '');

const packageVersion = (JSON.parse(fs.readFileSync(
    Path.join(__dirname, 'package.json'), 'utf-8'))).version;

program
    .description('Text to Speech transform block ' + packageVersion)
    .version(packageVersion)
    .requiredOption('--keyword <word>', 'Keyword or short sentence (e.g. "hello world")')
    .requiredOption('--label <label>', 'Label to be used in Edge Impulse (e.g. "helloworld")')
    .requiredOption('--lang <lang>', `Languages (comma-separated, or "all" for all), e.g. nl-NL,en-US`)
    .requiredOption('--count <count>', 'Number of keywords to generate')
    .option('--out-length <length>', 'Out length (default: 00:01)')
    .option('--skip-upload', 'Skip uploading to Edge Impulse')
    .allowUnknownOption(true)
    .parse(process.argv);

const keyword = program.keyword;
const label = program.label;
const selectedLanguages = program.lang.split(',');
const count = Number(program.count);
const outLength = program.outLength || '00:01';
const skipUpload = !!program.skipUpload;
if (isNaN(count)) {
    console.error('Invalid value --count, should be numeric');
}

// Creates a client
function getApiKeyCredentials() {
    const sslCreds = grpc.credentials.createSsl();
    const googleAuth = new GoogleAuth();
    const authClient = googleAuth.fromAPIKey(process.env.GOOGLE_CLOUD_TTS_API_KEY);
    const credentials = grpc.credentials.combineChannelCredentials(
        sslCreds,
        grpc.credentials.createFromGoogleCredential(authClient)
    );
    return credentials;
}

const client = new textToSpeech.TextToSpeechClient({
    sslCreds: getApiKeyCredentials()
});

let pitches = [-10, 0, 10 ];

let genders = [ 'FEMALE', 'MALE' ];

let languages = [
    'ar-XA', 'bn-IN',  'en-GB',  'fr-CA',
    'en-US', 'es-ES',  'fi-FI',  'gu-IN',
    'ja-JP', 'kn-IN',  'ml-IN',  'sv-SE',
    'ta-IN', 'tr-TR',  'cs-CZ',  'de-DE',
    'en-AU', 'en-IN',  'fr-FR',  'hi-IN',
    'id-ID', 'it-IT',  'ko-KR',  'ru-RU',
    'uk-UA', 'cmn-CN', 'cmn-TW', 'da-DK',
    'el-GR', 'fil-PH', 'hu-HU',  'nb-NO',
    'nl-NL', 'pt-PT',  'sk-SK',  'vi-VN',
    'pl-PL', 'pt-BR',  'ca-ES',  'yue-HK',
    'af-ZA', 'bg-BG',  'lv-LV',  'ro-RO',
    'sr-RS', 'th-TH',  'te-IN',  'is-IS'
];
if (selectedLanguages.indexOf('all') === -1) {
    for (let l of selectedLanguages) {
        if (languages.indexOf(l) === -1) {
            console.error('Invalid language', l, 'not in list of valid languages', languages);
        }
    }
    languages = selectedLanguages;
}

let text = [ keyword ];

let speakingRates = [ 0.75, 1, 1.25 ];

let allOpts = [];
for (let p of pitches) {
    for (let g of genders) {
        for (let l of languages) {
            for (let t of text) {
                for (let s of speakingRates) {
                    allOpts.push({
                        pitch: p,
                        gender: g,
                        language: l,
                        text: t,
                        speakingRate: s
                    });
                }
            }
        }
    }
}

if (allOpts.length > count) {
    let selectEvery = allOpts.length / count;
    let selectNext = 0;
    allOpts = allOpts.filter((x, ix) => {
        if (ix > selectNext) {
            selectNext += selectEvery;
            return true;
        }
        return false;
    });
}

// console.log('all options', allOpts);

(async () => {
    await rmDir('out-wav');
    await fs.promises.mkdir('out-mp3', { recursive: true });
    await fs.promises.mkdir('out-wav', { recursive: true });

    // let voices = await client.listVoices();
    // let languageCodes =  [...new Set(voices[0].voices.map(v => v.languageCodes[0]))];

    let downloadedFiles = [];

    let ix = 0;
    for (let o of allOpts) {
        ix++;
        const request = {
            input: {text: o.text },
            // Select the language and SSML voice gender (optional)
            voice: {languageCode: o.language, ssmlGender: o.gender },
            // select the type of audio encoding
            audioConfig: {audioEncoding: 'MP3', sampleRateHertz: 16000, pitch: o.pitch, speakingRate: o.speakingRate },
        };

        let hasHitApi = false;

        let mp3FileName = Path.join('out-mp3', label + '.' + o.language + '-' + o.gender + '-' + o.pitch + '-' + o.speakingRate + '.mp3');
        let wavFileName = Path.join('out-wav', label + '.' + o.language + '-' + o.gender + '-' + o.pitch + '-' + o.speakingRate + '.tts.wav');
        if (!fs.existsSync(mp3FileName)) {
            console.log(`[${ix}/${allOpts.length}] Text-to-speeching...`);
            // Performs the text-to-speech request
            const [response] = await client.synthesizeSpeech(request);
            // Write the binary audio content to a local file
            fs.writeFileSync(mp3FileName, response.audioContent, 'binary');
            hasHitApi = true;
        }

        if (!fs.existsSync(wavFileName)) {
            console.log(`[${ix}/${allOpts.length}] Converting to MP3...`);
            execSync(`sox -m "${mp3FileName}" silence.wav -r 16000 "${wavFileName}" trim 0 ` + outLength);
            // console.log('Audio content written to file:', wavFileName);
        }

        downloadedFiles.push({
            path: Path.resolve(wavFileName),
            label: label,
            category: 'split',
            metadata: {
                'imported_from': `Google Cloud TTS`,
            }
        });

        if (hasHitApi) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    console.log('Done text-to-speeching');
    console.log('');

    if (skipUpload) {
        console.log('--skip-upload is enabled, stopping now');
        return;
    }

    const inputFile = Path.join(await fs.promises.mkdtemp(Path.join(os.tmpdir(), 'ei-s3-sync-')), 'input.json');
    await fs.promises.mkdir(Path.dirname(inputFile), { recursive: true });

    let infoFile = {
        version: 1,
        files: downloadedFiles,
    };

    await fs.promises.writeFile(inputFile, JSON.stringify(infoFile));

    console.log(`Importing files into project...`);

    let r2 = spawnSync('edge-impulse-uploader', [
        '--info-file',
        inputFile,
        '--api-key',
        process.env.EI_PROJECT_API_KEY || '',
        '--silent',
        `--progress-interval`, `3000`
    ], {
        stdio: [process.stdin, process.stdout, process.stderr],
        encoding: 'utf-8',
        env: {
            EI_HOST: process.env.EI_INGESTION_HOST,
            PATH: process.env.PATH || '',
            NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
        }
    });

    if (r2.status !== 0) {
        console.log('Running edge-impulse-uploader failed', r2.status);
        process.exit(1);
    }

    console.log(`Importing files into project OK`);
})();

/**
 * Remove a directory and all its files and subfolders
 * @param folder
 */
 async function rmDir(folder) {
    if (!(await exists(folder))) return;

    const readdir = util.promisify(fs.readdir);

    let entries = await readdir(folder, { withFileTypes: true });
    await Promise.all(entries.map(async entry => {
        // skip .nfs files in the EFS storage layer
        if (entry.name.startsWith('.nfs')) return;

        let fullPath = Path.join(folder, entry.name);
        return entry.isDirectory() ? rmDir(fullPath) : safeUnlinkFile(fullPath);
    }));

    try {
        await util.promisify(fs.rmdir)(folder);
    }
    catch (ex) {
        // OK not great but OK there are some issues with removing files from EFS
        console.log(`WARN: Failed to remove ${folder}`, ex);
    }
}

async function exists(path) {
    let aexists = false;
    try {
        await util.promisify(fs.stat)(path);
        aexists = true;
    }
    catch (ex) {
        /* noop */
    }
    return aexists;
}

async function safeUnlinkFile(path) {
    try {
        await util.promisify(fs.unlink)(path);
    }
    catch (ex) {
        /* noop */
    }
}
